#!/usr/bin/env python3
"""
Setup script for Clip Scene Backend
Checks dependencies and provides installation instructions
"""

import subprocess
import sys
import platform

def check_python_version():
    """Check if Python version is 3.8+"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8+ is required")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def check_ffmpeg():
    """Check if FFmpeg is installed"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, text=True, check=True)
        version_line = result.stdout.split('\n')[0]
        print(f"✅ {version_line}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ FFmpeg not found")
        return False

def install_ffmpeg_instructions():
    """Provide FFmpeg installation instructions"""
    system = platform.system().lower()
    
    print("\n📦 FFmpeg Installation Instructions:")
    print("=" * 40)
    
    if system == "windows":
        print("Windows:")
        print("1. Download from: https://ffmpeg.org/download.html#build-windows")
        print("2. Extract and add to PATH")
        print("3. Or use: winget install ffmpeg")
        print("4. Or use Chocolatey: choco install ffmpeg")
    
    elif system == "darwin":  # macOS
        print("macOS:")
        print("1. Install Homebrew: https://brew.sh/")
        print("2. Run: brew install ffmpeg")
    
    elif system == "linux":
        print("Linux:")
        print("Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg")
        print("CentOS/RHEL: sudo yum install ffmpeg")
        print("Arch: sudo pacman -S ffmpeg")
    
    print("\n🔗 Official FFmpeg website: https://ffmpeg.org/")

def install_python_dependencies():
    """Install Python dependencies"""
    try:
        print("\n📦 Installing Python dependencies...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✅ Python dependencies installed successfully")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install Python dependencies")
        return False

def main():
    print("🎬 Clip Scene Backend Setup")
    print("=" * 30)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Check FFmpeg
    ffmpeg_ok = check_ffmpeg()
    if not ffmpeg_ok:
        install_ffmpeg_instructions()
        print("\n⚠️  Please install FFmpeg and run setup again")
        sys.exit(1)
    
    # Install Python dependencies
    if not install_python_dependencies():
        sys.exit(1)
    
    print("\n🎉 Setup completed successfully!")
    print("\n🚀 To start the server:")
    print("   python main.py")
    print("   or")
    print("   uvicorn main:app --reload --host 0.0.0.0 --port 8000")

if __name__ == "__main__":
    main() 