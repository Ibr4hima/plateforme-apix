#!/usr/bin/env python3
"""CLI de l'extracteur BMSCE — voir app/services/bmce_extraction.py."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.bmce_extraction import main  # noqa: E402

if __name__ == "__main__":
    main()
