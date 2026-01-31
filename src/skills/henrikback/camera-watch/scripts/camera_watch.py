#!/usr/bin/env python3
"""
Camera Watch - Object Detection on IP Cameras
==============================================
Uses YOLOv8 to detect objects on Hikvision/RTSP cameras.
Sends notifications with snapshots when configured objects are detected.

Supports HTTP snapshot mode (reliable) and RTSP streaming.
"""

import cv2
import yaml
import time
import logging
import threading
import subprocess
import requests
import os
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
from ultralytics import YOLO

# ============================================
# Configuration
# ============================================

def load_config(config_path="config.yaml"):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)

# ============================================
# Logging
# ============================================

def setup_logging(config):
    log_dir = Path(config["logging"]["file"]).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, config["logging"]["level"]),
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(config["logging"]["file"]),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

# ============================================
# Notifications
# ============================================

class Notifier:
    def __init__(self, config):
        self.config = config["notifications"]
        self.enabled = self.config.get("enabled", True)
        self.cooldown = self.config.get("cooldown_seconds", 60)
        self.last_notification = defaultdict(lambda: datetime.min)
        
        # Clawdbot gateway settings
        self.gateway_url = self.config.get("gateway_url", "http://localhost:18789")
        self.gateway_token = self.config.get("gateway_token", "")
    
    def can_notify(self, camera_name, object_type):
        key = f"{camera_name}:{object_type}"
        now = datetime.now()
        if now - self.last_notification[key] > timedelta(seconds=self.cooldown):
            self.last_notification[key] = now
            return True
        return False
    
    def send(self, camera_name, object_type, confidence, snapshot_path=None):
        if not self.enabled:
            return
        
        if not self.can_notify(camera_name, object_type):
            logging.debug(f"Notification cooldown for {camera_name}:{object_type}")
            return
        
        message = f"🚨 {object_type.upper()} detected!\n📍 Camera: {camera_name}\n📊 Confidence: {confidence:.0%}"
        
        if snapshot_path and Path(snapshot_path).exists():
            message += f"\n📸 Snapshot saved"
        
        # Send via WhatsApp (via Clawdbot gateway)
        if whatsapp := self.config.get("whatsapp"):
            self._send_whatsapp(whatsapp, message, snapshot_path)
    
    def _send_whatsapp(self, number, message, image_path=None):
        """Send via Clawdbot gateway API"""
        try:
            url = f"{self.gateway_url}/api/message/send"
            headers = {"Content-Type": "application/json"}
            
            if self.gateway_token:
                headers["Authorization"] = f"Bearer {self.gateway_token}"
            
            payload = {
                "channel": "whatsapp",
                "to": number,
                "message": message
            }
            
            if image_path and Path(image_path).exists():
                payload["mediaPath"] = str(Path(image_path).absolute())
            
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.ok:
                logging.info(f"WhatsApp notification sent to {number}")
            else:
                logging.error(f"WhatsApp failed: {response.text}")
        except Exception as e:
            logging.error(f"WhatsApp error: {e}")

# ============================================
# Recorder - Snapshots
# ============================================

class Recorder:
    def __init__(self, config):
        self.config = config["recordings"]
        self.snapshots_dir = Path(self.config["snapshots_dir"])
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)
    
    def save_snapshot(self, camera_name, frame, object_type):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{camera_name}_{object_type}_{timestamp}.jpg"
        path = self.snapshots_dir / filename
        cv2.imwrite(str(path), frame)
        logging.info(f"Snapshot saved: {path}")
        return str(path)

# ============================================
# Camera Stream Handler (HTTP Snapshot mode)
# ============================================

class CameraStream:
    def __init__(self, camera_id, camera_config, model, notifier, recorder):
        self.camera_id = camera_id
        self.config = camera_config
        self.name = camera_config["name"]
        self.track = set(camera_config.get("track", ["person"]))
        self.confidence = camera_config.get("confidence", 0.5)
        
        # Camera connection info
        self.ip = camera_config.get("ip", "192.168.1.100")
        self.channel = camera_config.get("channel", 1)
        self.user = camera_config.get("user", "admin")
        self.password = camera_config.get("password", "password")
        self.poll_interval = camera_config.get("poll_interval", 2)
        
        self.model = model
        self.notifier = notifier
        self.recorder = recorder
        
        self.running = False
        self.thread = None
        self.last_frame = None
    
    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logging.info(f"Started camera: {self.name} (HTTP snapshot mode, {self.poll_interval}s interval)")
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logging.info(f"Stopped camera: {self.name}")
    
    def _get_snapshot(self):
        """Get snapshot via HTTP API (Hikvision ISAPI)"""
        try:
            import tempfile
            
            # Hikvision ISAPI snapshot URL
            url = f"http://{self.ip}/ISAPI/Streaming/channels/{self.channel}01/picture"
            
            # Use temp file
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                tmp_path = tmp.name
            
            # Use curl for digest auth
            result = subprocess.run([
                'curl', '-s', '--digest', 
                '-u', f'{self.user}:{self.password}',
                url, '-o', tmp_path
            ], capture_output=True, timeout=10)
            
            if result.returncode == 0:
                frame = cv2.imread(tmp_path)
                os.unlink(tmp_path)
                if frame is not None:
                    return frame
            
            logging.warning(f"[{self.name}] Snapshot failed")
            return None
        except Exception as e:
            logging.error(f"[{self.name}] Snapshot error: {e}")
            return None
    
    def _run(self):
        """Main loop for camera"""
        while self.running:
            frame = self._get_snapshot()
            
            if frame is not None:
                self.last_frame = frame
                self._detect(frame)
            
            time.sleep(self.poll_interval)
    
    def _detect(self, frame):
        """Run object detection on frame"""
        # Run YOLO
        results = self.model(frame, verbose=False, conf=self.confidence)
        
        # Process results
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                cls_name = self.model.names[cls_id]
                conf = float(box.conf[0])
                
                # Check if we're tracking this type
                if cls_name in self.track:
                    logging.info(f"[{self.name}] Detected: {cls_name} ({conf:.0%})")
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, f"{cls_name} {conf:.0%}", (x1, y1-10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    
                    # Save snapshot
                    snapshot_path = self.recorder.save_snapshot(self.camera_id, frame, cls_name)
                    
                    # Send notification
                    self.notifier.send(self.name, cls_name, conf, snapshot_path)

# ============================================
# Main Application
# ============================================

class CameraWatch:
    def __init__(self, config_path="config.yaml"):
        self.config = load_config(config_path)
        self.logger = setup_logging(self.config)
        
        # Load YOLO model
        model_name = self.config["model"]["name"]
        device = self.config["model"]["device"]
        self.logger.info(f"Loading YOLO model: {model_name} on {device}")
        self.model = YOLO(f"{model_name}.pt")
        
        # Initialize components
        self.notifier = Notifier(self.config)
        self.recorder = Recorder(self.config)
        
        # Initialize cameras
        self.cameras = {}
        for cam_id, cam_config in self.config["cameras"].items():
            if cam_config.get("enabled", True):
                self.cameras[cam_id] = CameraStream(
                    cam_id, cam_config, self.model, self.notifier, self.recorder
                )
    
    def start(self):
        self.logger.info("=" * 50)
        self.logger.info("Camera Watch Starting")
        self.logger.info("=" * 50)
        
        for camera in self.cameras.values():
            camera.start()
        
        self.logger.info(f"Watching {len(self.cameras)} camera(s)")
        
        # Keep main thread running
        try:
            while True:
                time.sleep(10)
        except KeyboardInterrupt:
            self.logger.info("Shutting down...")
            self.stop()
    
    def stop(self):
        for camera in self.cameras.values():
            camera.stop()
        self.logger.info("Camera Watch stopped")

# ============================================
# Entry Point
# ============================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Camera Watch - Object Detection")
    parser.add_argument("-c", "--config", default="config.yaml", help="Config file path")
    parser.add_argument("--test", action="store_true", help="Test mode: check cameras and exit")
    args = parser.parse_args()
    
    app = CameraWatch(args.config)
    
    if args.test:
        print("Test mode - checking cameras...")
        for cam_id, cam in app.cameras.items():
            print(f"  {cam.name}: {cam.ip} channel {cam.channel}")
            frame = cam._get_snapshot()
            if frame is not None:
                print(f"    ✓ Snapshot OK ({frame.shape[1]}x{frame.shape[0]})")
            else:
                print(f"    ✗ Snapshot FAILED")
        print("Model loaded:", app.config["model"]["name"])
        print("Done!")
    else:
        app.start()
