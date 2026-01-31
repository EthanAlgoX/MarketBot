---
name: camera-watch
description: YOLOv8-based camera surveillance with object detection. Works with any IP camera supporting RTSP streams or HTTP snapshots (Hikvision, Dahua, Reolink, Amcrest, Unifi, and more). Detects 80+ object types (person, car, dog, etc.) and sends notifications with snapshots. Use for motion detection, night watch routines, or security monitoring.
---

# Camera Watch

Real-time object detection on IP cameras using YOLOv8. Works with any camera supporting RTSP or HTTP snapshots. Detects people, vehicles, animals, and 80+ object types. Sends notifications with snapshots when objects are detected.

## Features

- HTTP snapshot mode (reliable) or RTSP streaming
- YOLOv8 object detection (80 COCO classes)
- WhatsApp/iMessage notifications with snapshots
- Configurable confidence threshold and cooldown
- Multi-camera support

## Setup

### 1. Create project directory

```bash
mkdir -p ~/camera-watch && cd ~/camera-watch
python -m venv venv
source venv/bin/activate
pip install opencv-python ultralytics pyyaml requests
```

### 2. Copy scripts

Copy `scripts/camera_watch.py` to your project directory.

### 3. Create config.yaml

```yaml
notifications:
  enabled: true
  whatsapp: "+1234567890"  # Your phone number
  cooldown_seconds: 60

recordings:
  snapshots_dir: "./snapshots"
  keep_days: 7

logging:
  file: "./logs/detections.log"
  level: "INFO"

cameras:
  front-door:
    name: "Front Door"
    ip: "192.168.1.100"      # Your camera IP
    channel: 1               # Hikvision channel number
    user: "admin"            # Camera username
    password: "yourpassword" # Camera password
    poll_interval: 2
    enabled: true
    track:
      - person
      - car
    confidence: 0.5

model:
  name: "yolov8s"  # Options: yolov8n (fast), yolov8s (balanced), yolov8m (accurate)
  device: "cpu"    # Use "mps" for Apple Silicon, "cuda" for NVIDIA
```

### 4. Run

```bash
# Test cameras
python camera_watch.py --test

# Run in foreground
python camera_watch.py

# Run in background
nohup python camera_watch.py > /tmp/camera-watch.log 2>&1 &
```

## Detectable Objects (YOLOv8 COCO)

**People & Animals:**
person, bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe

**Vehicles:**
bicycle, car, motorcycle, airplane, bus, train, truck, boat

**Common objects:**
backpack, umbrella, handbag, suitcase, bottle, cup, chair, couch, bed, laptop, cell phone, tv

**Full list:** 80 classes including sports equipment, food items, furniture, and more.

## Integration with Night Watch

For automated night routines, create a separate script that:
1. Starts camera-watch at night (e.g., 00:00)
2. Stops camera-watch in morning (e.g., 07:00)
3. Sends report with detections and snapshots

Example cron integration:
```bash
# Start at midnight
0 0 * * * cd ~/camera-watch && source venv/bin/activate && nohup python camera_watch.py > /tmp/camera-watch.log 2>&1 &

# Stop at 7am and send report
0 7 * * * pkill -f camera_watch.py
```

## Notifications

The script sends notifications via Clawdbot gateway API. Ensure Clawdbot is running and configure the gateway URL in the script if needed.

## Troubleshooting

**Camera not connecting:**
- Verify IP address and credentials
- Check if camera supports ISAPI (Hikvision) or try RTSP
- Ensure camera is on same network

**False positives:**
- Increase confidence threshold (0.5 → 0.7)
- Clean camera lens (spider webs, insects)
- Adjust detection area if possible

**High CPU usage:**
- Increase poll_interval (2 → 5 seconds)
- Use smaller model (yolov8n instead of yolov8s)
