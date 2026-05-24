#!/bin/bash

VENV_DIR=".venv"

set -euo pipefail
pushd "$(dirname "$0")/.." >/dev/null

echo "Removing $VENV_DIR"
if [ -d "$VENV_DIR" ]; then
  rm -rf "$VENV_DIR"
fi

echo "Creating $VENV_DIR..."
python3 -m venv "$VENV_DIR"
if [ ! -f "$VENV_DIR/bin/python" ]; then
  echo "Failed to create $VENV_DIR. Ensure Python can create venvs."
  exit 1
fi

echo "Upgrading pip..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip

echo "Installing packages..."
if [ -f "requirements.txt" ]; then
  "$VENV_DIR/bin/python" -m pip install -r requirements.txt
else
  echo "requirements.txt not found. Skipping package installation."
fi

"$VENV_DIR/bin/python" -m pip list

popd >/dev/null
echo "Success."
