#!/usr/bin/env python3
"""
Generate images using Seedream API (synchronous).

Usage:
    python3 generate_image.py --prompt "description" --filename "output.png" [--model doubao-seedream-4.5] [--size 2048x2048]
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional

API_BASE = "https://ark.cn-beijing.volces.com/api/v3/images/generations"


def get_api_key() -> Optional[str]:
    """Get API key from environment."""
    return os.environ.get("SEEDREAM_API_KEY")


def generate_image(
    api_key: str,
    prompt: str,
    size: Optional[str],
    image_urls: Optional[list[str]],
) -> dict:
    """Generate image using Seedream API."""
    import json
    import ssl
    import urllib.request

    payload = {
        "model": "doubao-seedream-4-5-251128",
        "prompt": prompt,
        "response_format": "url",
        "watermark": False,
    }
    
    if size:
        payload["size"] = size
    if image_urls:
        payload["image"] = image_urls[0] if len(image_urls) == 1 else image_urls

    req = urllib.request.Request(
        API_BASE,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Moltbot/1.0",
        },
    )

    # Create SSL context that doesn't verify certificates (for testing)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=300, context=ssl_context) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            error_data = json.loads(error_body)
            error_msg = error_data.get("error", {}).get("message", error_body)
            error_code = error_data.get("error", {}).get("code", str(e.code))
        except:
            error_msg = error_body
            error_code = str(e.code)
        raise Exception(f"API error ({error_code}): {error_msg}")
    except Exception as e:
        raise Exception(f"Request failed: {e}")


def save_image_from_url(image_url: str, output_path: Path) -> None:
    """Download image from URL to file."""
    import ssl
    import urllib.request

    # Create SSL context that doesn't verify certificates
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": "Moltbot/1.0"})
        with urllib.request.urlopen(req, context=ssl_context) as response:
            with open(output_path, "wb") as f:
                f.write(response.read())
    except Exception as e:
        raise Exception(f"Download failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="Generate images using Seedream API (doubao-seedream-4.5)")
    parser.add_argument("--prompt", "-p", required=True, help="Image description/prompt")
    parser.add_argument("--filename", "-f", required=True, help="Output filename (e.g., output.png)")
    parser.add_argument("--size", "-s", help="Size: 2K/4K or pixels (e.g., 2048x2048)")
    parser.add_argument("--input-image", "-i", help="Input image URL for image-to-image")

    args = parser.parse_args()

    # Get API key
    api_key = get_api_key()
    if not api_key:
        print("Error: SEEDREAM_API_KEY not set.", file=sys.stderr)
        print("Configure in ~/.clawdbot/clawdbot.json:", file=sys.stderr)
        print('  skills: { entries: { "seedream-image-gen": { apiKey: "YOUR_KEY" } } }', file=sys.stderr)
        sys.exit(1)

    # Set up output path
    output_path = Path(args.filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Prepare image URLs if provided
    image_urls = [args.input_image] if args.input_image else None

    try:
        # Generate image
        print(f"Generating image with doubao-seedream-4.5...")
        result = generate_image(
            api_key,
            args.prompt,
            args.size,
            image_urls,
        )

        # Check for errors in response
        if "error" in result:
            error = result["error"]
            raise Exception(f"API error: {error.get('message', 'Unknown error')}")

        # Get image data
        data = result.get("data")
        if not data or not isinstance(data, list) or len(data) == 0:
            raise Exception("No image data in response")

        # Handle first image (or multiple if group generation)
        first_image = data[0]
        
        # Check if this image has an error
        if "error" in first_image:
            error = first_image["error"]
            raise Exception(f"Image generation error: {error.get('message', 'Unknown error')}")

        # Save image
        image_url = first_image.get("url")
        if not image_url:
            raise Exception("No image URL in response")
        print(f"Image ready: {image_url}")
        print(f"Downloading to {output_path}...")
        save_image_from_url(image_url, output_path)

        full_path = output_path.resolve()
        print(f"\nImage saved: {full_path}")
        print(f"MEDIA: {full_path}")

        # If multiple images generated, mention them
        if len(data) > 1:
            print(f"\nNote: {len(data)} images generated. Only first image saved to {output_path}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

