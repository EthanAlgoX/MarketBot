#!/usr/bin/env python3
"""
Example: Spanish Catastro API with VPN rotation

Catastro blocks after ~10 requests. This example shows
how to use VPN rotation to bypass the rate limit.
"""

import sys
from pathlib import Path

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import requests
from decorator import with_vpn_rotation


# Catastro API endpoint
CATASTRO_URL = "http://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPPP"


@with_vpn_rotation(rotate_every=5, delay=2.0, verbose=True)
def query_catastro(provincia: str, municipio: str, poligono: int, parcela: int) -> dict:
    """Query Catastro for property data."""
    params = {
        "Provincia": provincia.upper(),
        "Municipio": municipio.upper(),
        "Poligono": str(poligono),
        "Parcela": str(parcela)
    }
    
    response = requests.get(CATASTRO_URL, params=params, timeout=15)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": f"HTTP {response.status_code}"}


def main():
    print("🏠 Catastro API Example")
    print("=" * 40)
    print()
    
    # Sample properties to query
    properties = [
        ("VALENCIA", "SIETE AGUAS", 1, 728),
        ("VALENCIA", "SIETE AGUAS", 1, 729),
        ("VALENCIA", "SIETE AGUAS", 1, 730),
        ("VALENCIA", "SIETE AGUAS", 1, 731),
        ("VALENCIA", "SIETE AGUAS", 1, 732),
        ("VALENCIA", "SIETE AGUAS", 1, 733),
    ]
    
    print(f"Querying {len(properties)} properties...")
    print("(VPN will rotate every 5 requests)")
    print()
    
    for prov, muni, pg, pa in properties:
        result = query_catastro(prov, muni, pg, pa)
        
        if "error" in result:
            print(f"❌ {muni} PG{pg}/PA{pa}: {result['error']}")
        else:
            # Extract superficie if available
            try:
                bi = result.get("consulta_dnpppResult", {}).get("bico", {}).get("bi", {})
                if isinstance(bi, list):
                    bi = bi[0] if bi else {}
                superficie = bi.get("debi", {}).get("sfc", "N/A")
                print(f"✅ {muni} PG{pg}/PA{pa}: {superficie} m²")
            except:
                print(f"✅ {muni} PG{pg}/PA{pa}: Data received")
    
    print()
    print("Cleaning up...")
    query_catastro.cleanup()
    print("Done!")


if __name__ == "__main__":
    main()
