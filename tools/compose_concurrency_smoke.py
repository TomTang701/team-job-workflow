"""Exercise uniqueness conflicts against a running Team Job Workflow API."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import threading
import urllib.error
import urllib.request
import uuid


def request(base_url: str, method: str, path: str, body: dict[str, str], access_token: str | None = None) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    request_data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(f"{base_url}{path}", data=request_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        response_data = error.read().decode("utf-8")
        return error.code, json.loads(response_data) if response_data else {}


def concurrent_post_statuses(base_url: str, path: str, body: dict[str, str], access_token: str | None = None) -> list[int]:
    barrier = threading.Barrier(2)

    def post_once(_: int) -> int:
        barrier.wait(timeout=10)
        status, _ = request(base_url, "POST", path, body, access_token)
        return status

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        return sorted(executor.map(post_once, range(2)))


def require_statuses(label: str, statuses: list[int]) -> None:
    if statuses != [201, 409]:
        raise RuntimeError(f"{label} expected [201, 409], received {statuses}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    run_id = uuid.uuid4().hex
    generated_credential = uuid.uuid4().hex

    registration_statuses = concurrent_post_statuses(
        base_url,
        "/api/auth/register",
        {"email": f"compose-race-{run_id}@example.test", "password": generated_credential},
    )
    require_statuses("Concurrent registration", registration_statuses)

    owner_status, owner = request(
        base_url,
        "POST",
        "/api/auth/register",
        {"email": f"compose-owner-{run_id}@example.test", "password": generated_credential},
    )
    member_status, member = request(
        base_url,
        "POST",
        "/api/auth/register",
        {"email": f"compose-member-{run_id}@example.test", "password": generated_credential},
    )
    if owner_status != 201 or member_status != 201:
        raise RuntimeError("Concurrent membership setup registration failed.")

    workspace_status, workspace = request(
        base_url,
        "POST",
        "/api/workspaces",
        {"name": f"Concurrent workspace {run_id}"},
        owner["access_token"],
    )
    if workspace_status != 201:
        raise RuntimeError("Concurrent membership setup workspace creation failed.")

    membership_statuses = concurrent_post_statuses(
        base_url,
        f"/api/workspaces/{workspace['id']}/members",
        {"email": member["user"]["email"], "role": "member"},
        owner["access_token"],
    )
    require_statuses("Concurrent membership creation", membership_statuses)
    print(f"Concurrent registration statuses: {registration_statuses}")
    print(f"Concurrent membership statuses: {membership_statuses}")


if __name__ == "__main__":
    main()
