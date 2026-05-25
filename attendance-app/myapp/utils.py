# myapp/utils.py
import requests

def get_place_name(latitude, longitude):
    """
    Given lat/lon, returns a human-readable place name.
    Uses OpenStreetMap Nominatim — free, no API key needed.
    """
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "zoom": 14,           # city/suburb level
            "addressdetails": 1
        }
        headers = {
            "User-Agent": "WMS-Attendance-App/1.0"  # Nominatim requires this
        }
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()

        address = data.get("address", {})

        # Build a clean place string: suburb/area, city, state
        parts = []
        suburb = address.get("suburb") or address.get("neighbourhood") or address.get("village")
        city   = address.get("city") or address.get("town") or address.get("county")
        state  = address.get("state")

        if suburb: parts.append(suburb)
        if city:   parts.append(city)
        if state:  parts.append(state)

        return ", ".join(parts) if parts else data.get("display_name", "Unknown location")

    except Exception:
        return "Location unavailable"