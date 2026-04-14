
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPickerProps {
  initialLat: number;
  initialLng: number;
  radius: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

const LocationMarker = ({ lat, lng, radius, onLocationSelect }: { 
  lat: number; 
  lng: number; 
  radius: number;
  onLocationSelect: (lat: number, lng: number) => void 
}) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom());
  }, [lat, lng, map]);

  return (
    <>
      <Marker position={[lat, lng]} />
      <Circle center={[lat, lng]} radius={radius} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 }} />
    </>
  );
};

export const MapPicker: React.FC<MapPickerProps> = ({ initialLat, initialLng, radius, onLocationSelect }) => {
  return (
    <div className="h-64 w-full relative overflow-hidden rounded-lg shadow-inner border border-slate-200">
      <MapContainer center={[initialLat, initialLng]} zoom={15} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker lat={initialLat} lng={initialLng} radius={radius} onLocationSelect={onLocationSelect} />
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-500 font-medium pointer-events-none">
        Click on map to pick location
      </div>
    </div>
  );
};
