#!/usr/bin/env python3
"""Deploy script for StreamDock plugin.

Copies the .sdPlugin directory to the platform-specific StreamDock plugins folder.

Usage: python3 deploy.py [<plugin-folder-name>]
       Default plugin folder: it.devthis.shellycontrol.sdPlugin
"""
import argparse
import os
import platform
import shutil
import sys
from pathlib import Path


def get_plugins_dir() -> Path:
    system = platform.system()
    home = Path.home()

    if system == "Darwin":  # macOS
        return home / "Library/Application Support/HotSpot/StreamDock/plugins"
    elif system == "Windows":
        appdata = os.environ.get("APPDATA", home / "AppData/Roaming")
        return Path(appdata) / "HotSpot/StreamDock/plugins"
    elif system == "Linux":
        return home / ".config/HotSpot/StreamDock/plugins"
    else:
        raise OSError(f"Unsupported platform: {system}")


def deploy(plugin_folder: str):
    repo_root = Path(__file__).parent
    plugin_dir = repo_root / plugin_folder

    if not plugin_dir.exists():
        print(f"Plugin directory not found: {plugin_dir}")
        sys.exit(1)

    target_dir = get_plugins_dir()
    target_dir.mkdir(parents=True, exist_ok=True)

    destination = target_dir / plugin_dir.name

    if destination.exists():
        print(f"Removing existing plugin at {destination}")
        shutil.rmtree(destination)

    print(f"Copying {plugin_dir} -> {destination}")
    shutil.copytree(plugin_dir, destination)
    print("Deploy complete.")
    print(f"Restart StreamDock to load the plugin.")
    print(f"Debug URL: http://localhost:23519/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy StreamDock plugin")
    parser.add_argument(
        "plugin_folder",
        nargs="?",
        default="it.devthis.shellycontrol.sdPlugin",
        help="Plugin folder name to deploy (default: it.devthis.shellycontrol.sdPlugin)",
    )
    args = parser.parse_args()
    deploy(args.plugin_folder)