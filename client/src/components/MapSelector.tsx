import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect } from 'react';

// Fix for default marker icons in Leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  radius?: number;
}

function LocationMarker({ lat, lng, onLocationSelect }: { lat: number; lng: number; onLocationSelect: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<L.LatLng>(L.latLng(lat, lng));

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker 
      position={position} 
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setPosition(pos);
          onLocationSelect(pos.lat, pos.lng);
        },
      }}
    />
  );
}

export function MapSelector({ lat, lng, onLocationSelect, radius }: MapSelectorProps) {
  return (
    <div className="h-[300px] w-full rounded-lg overflow-hidden border-2 border-muted relative z-0">
      <MapContainer 
        center={[lat, lng]} 
        zoom={15} 
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker lat={lat} lng={lng} onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
}
