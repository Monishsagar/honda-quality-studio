import { InspectionDomain } from './vehicle';

export type AppViewMode = 
  | 'showroom'            // Walking/exploring the 3D showroom
  | 'inspection'          // Focused on one vehicle for deep inspection
  | 'comparison'          // Side-by-side reference comparison
  | 'report';             // Comprehensive TQM report view

export type CameraControlMode = 'fps' | 'orbit' | 'cinematic';

export type VisualRenderMode = 'solid' | 'xray' | 'wireframe' | 'exploded';

export interface UserSettings {
  walkSpeed: number;
  mouseSensitivity: number;
  invertY: boolean;
  fieldOfView: number;
  soundEffects: boolean;
  showMinimap: boolean;
  highQualityShadows: boolean;
  autoRotateShowroom: boolean;
}

export interface PlayerState {
  position: [number, number, number];
  rotation: [number, number, number];
  isWalking: boolean;
  isSprinting: boolean;
  isPointerLocked: boolean;
  nearbyVehicleId: string | null;
}
