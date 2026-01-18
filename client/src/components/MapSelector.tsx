import { MapContainer, TileLayer, Marker, useMapEvents, Circle, Popup } from 'react-leaflet';
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

// Custom icon for existing checkpoints
let CheckpointIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [20, 32],
    iconAnchor: [10, 32],
    className: 'hue-rotate-[240deg]' // Makes it look different (blue/purple)
});

// Custom icon for player location
let PlayerIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: 'hue-rotate-[120deg]' // Makes it look green
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  radius?: number;
  existingCheckpoints?: { lat: number; lng: number; id: number; isCustom?: boolean; isRoving?: boolean }[];
  onCheckpointMove?: (id: number, lat: number, lng: number) => void;
  playerLocation?: { lat: number; lng: number };
}

function LocationMarker({ lat, lng, onLocationSelect }: { lat: number; lng: number; onLocationSelect: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<L.LatLng>(L.latLng(lat, lng));

  useEffect(() => {
    setPosition(L.latLng(lat, lng));
  }, [lat, lng]);

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
      zIndexOffset={1000}
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

export function MapSelector({ lat, lng, onLocationSelect, radius, existingCheckpoints, playerLocation, onCheckpointMove }: MapSelectorProps) {
  return (
    <div className="h-[300px] w-full rounded-lg overflow-hidden border-2 border-muted relative z-0">
      <MapContainer 
        center={[lat, lng]} 
        zoom={15} 
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Radius circle around center/selection */}
        {radius && (
          <Circle 
            center={[lat, lng]} 
            radius={radius} 
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }} 
          />
        )}

        {/* Existing checkpoints */}
        {existingCheckpoints?.map((cp) => (
          <Marker 
            key={`cp-${cp.id}-${cp.isCustom ? 'custom' : 'random'}`} 
            position={[cp.lat, cp.lng]} 
            icon={cp.isRoving ? PlayerIcon : CheckpointIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                if (onCheckpointMove) {
                  const pos = e.target.getLatLng();
                  onCheckpointMove(cp.id, pos.lat, pos.lng);
                }
              }
            }}
          >
            <Popup>
              <div className="text-sm font-medium">
                {cp.isRoving ? 'Roving' : cp.isCustom ? 'Custom' : 'Random'} Checkpoint
              </div>
              <div className="text-xs text-muted-foreground">ID: {cp.id}</div>
            </Popup>
          </Marker>
        ))}

        {/* Player location */}
        {playerLocation && (
          <Marker 
            position={[playerLocation.lat, playerLocation.lng]} 
            icon={PlayerIcon}
            zIndexOffset={500}
          />
        )}

        <LocationMarker lat={lat} lng={lng} onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
}
