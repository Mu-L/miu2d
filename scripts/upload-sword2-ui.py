#!/usr/bin/env python3
"""Upload missing sword2 UI files to MinIO via tRPC API."""

import json
import os
import sys
import uuid

import requests

BASE_URL = "http://localhost:4000"
GAME_ID = "49ee9787-e2c2-40b8-8f55-074ff1af075e"
LOCAL_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resources-sword2-new")

# Files that the INI references but don't exist in MinIO
MISSING_FILES = [
    "asf/ui/bottom/btnequip.msf",
    "asf/ui/bottom/btngoods.msf",
    "asf/ui/bottom/btnmagic.msf",
    "asf/ui/bottom/btnnotes.msf",
    "asf/ui/bottom/btnoption.msf",
    "asf/ui/bottom/btnstate.msf",
    "asf/ui/bottom/btnxiulian.msf",
    "asf/ui/column/column1.msf",
    "asf/ui/common/closebtn.msf",
    "asf/ui/equip/image.msf",
    "asf/ui/message/btnno.msf",
    "asf/ui/message/btnyes.msf",
    "asf/ui/message/msgboard.msf",
    "asf/ui/state/image.msf",
]


def login(session: requests.Session) -> None:
    """Login and store session cookie."""
    resp = session.post(
        f"{BASE_URL}/trpc/auth.login",
        json={"email": "admin@qq.com", "password": "chenwei"},
        headers={"Content-Type": "application/json"},
    )
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    print("✓ Logged in")


def ensure_folder(session: requests.Session, path_parts: list[str]) -> str:
    """Ensure folder path exists, return final folder ID."""
    resp = session.post(
        f"{BASE_URL}/trpc/file.ensureFolderPath",
        json={"gameId": GAME_ID, "pathParts": path_parts},
        headers={"Content-Type": "application/json"},
    )
    if resp.status_code != 200:
        print(f"ensureFolderPath failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    data = resp.json()
    # tRPC wraps result in { result: { data: { folderId: "..." } } }
    result = data.get("result", {}).get("data", data)
    if isinstance(result, dict):
        return result.get("folderId", result.get("id", str(result)))
    return str(result)


def upload_file(session: requests.Session, rel_path: str) -> bool:
    """Upload a single file. Returns True on success."""
    local_path = os.path.join(LOCAL_ROOT, rel_path)
    if not os.path.exists(local_path):
        print(f"  ✗ Local file not found: {local_path}")
        return False

    file_size = os.path.getsize(local_path)
    file_name = os.path.basename(rel_path)
    folder_parts = rel_path.split("/")[:-1]  # e.g., ["asf", "ui", "bottom"]

    # Step 1: Ensure folder path
    folder_id = ensure_folder(session, folder_parts)
    print(f"  Folder: {'/'.join(folder_parts)} → {folder_id}")

    # Step 2: Prepare upload
    resp = session.post(
        f"{BASE_URL}/trpc/file.prepareUpload",
        json={
            "gameId": GAME_ID,
            "parentId": folder_id,
            "name": file_name,
            "size": file_size,
            "mimeType": "application/octet-stream",
        },
        headers={"Content-Type": "application/json"},
    )
    if resp.status_code != 200:
        data = resp.json()
        error_msg = json.dumps(data, ensure_ascii=False)
        if "CONFLICT" in error_msg or "already exists" in error_msg.lower():
            print(f"  → Already exists, skipping")
            return True
        print(f"  ✗ prepareUpload failed: {resp.status_code} {error_msg}")
        return False

    data = resp.json()
    result = data.get("result", {}).get("data", data)
    file_id = result["fileId"]
    upload_url = result["uploadUrl"]
    print(f"  fileId: {file_id}")

    # Step 3: PUT file to presigned URL
    with open(local_path, "rb") as f:
        file_data = f.read()

    put_resp = requests.put(
        upload_url,
        data=file_data,
        headers={"Content-Type": "application/octet-stream"},
    )
    if put_resp.status_code not in (200, 201):
        print(f"  ✗ PUT failed: {put_resp.status_code}")
        return False

    # Step 4: Confirm upload
    resp = session.post(
        f"{BASE_URL}/trpc/file.confirmUpload",
        json={"fileId": file_id},
        headers={"Content-Type": "application/json"},
    )
    if resp.status_code != 200:
        print(f"  ✗ confirmUpload failed: {resp.status_code} {resp.text}")
        return False

    print(f"  ✓ Uploaded ({file_size} bytes)")
    return True


def main():
    session = requests.Session()
    login(session)

    success = 0
    failed = 0
    for rel_path in MISSING_FILES:
        print(f"\nUploading: {rel_path}")
        if upload_file(session, rel_path):
            success += 1
        else:
            failed += 1

    print(f"\n=== Done: {success} uploaded, {failed} failed ===")


if __name__ == "__main__":
    main()
