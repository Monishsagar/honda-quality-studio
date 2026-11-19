import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useShowroomStore } from './store/useShowroomStore';
import { ShowroomScene } from './components/3d/ShowroomScene';
import { FirstPersonControls } from './components/3d/FirstPersonControls';
import { CameraDirector } from './components/3d/CameraDirector';
import { LabelLayer } from './components/3d/LabelLayer';
import { PostFX } from './components/3d/PostFX';
import { InspectionUI } from './ui/InspectionUI';
import { ShowroomUI, Loader } from './ui/ShowroomUI';
import { ReferenceComparisonModal } from './components/ui/ReferenceComparisonModal';
import { TQMReportModal } from './components/ui/TQMReportModal';
import { SettingsModal } from './components/ui/SettingsModal';
import { TQMPillarsModal } from './components/ui/TQMPillarsModal';
import { DefectSimulatorModal } from './components/ui/DefectSimulatorModal';
import { PDCACycleModal } from './components/ui/PDCACycleModal';
import './ui/lab.css';

const params = new URLSearchParams(window.location.search);
const NO_FX = params.has('nofx');
const NO_AO = params.has('noao');

/** Tells the loader the scene has drawn a few frames (cars built, shaders compiled). */
function SceneReady() {
  const n = useRef(0);
  useFrame(() => {
    n.current++;
    if (n.current === 4) window.dispatchEvent(new Event('scene-ready'));
  });
  return null;
}

export default function App() {
  const { viewMode, settings, isTQMPillarsModalOpen, setTQMPillarsModalOpen } = useShowroomStore();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#d9d8d4]">
      <Canvas
        shadows={settings.highQualityShadows ? 'soft' : true}
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.65, 9], fov: settings.fieldOfView, near: 0.03, far: 200 }}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.82 }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        className="w-full h-full"
      >
        <color attach="background" args={['#d9d8d4']} />
        <fog attach="fog" args={['#d9d8d4', 30, 70]} />
        <Suspense fallback={null}>
          <ShowroomScene />
          {viewMode === 'showroom' && <FirstPersonControls />}
          {viewMode === 'inspection' && <CameraDirector />}
          <LabelLayer />
          <SceneReady />
        </Suspense>
        {!NO_FX && <PostFX hq={settings.highQualityShadows && !NO_AO} />}
      </Canvas>

      <ShowroomUI />
      <InspectionUI />
      <ReferenceComparisonModal />
      <TQMReportModal />
      <SettingsModal />
      <DefectSimulatorModal />
      <PDCACycleModal />
      <TQMPillarsModal isOpen={isTQMPillarsModalOpen} onClose={() => setTQMPillarsModalOpen(false)} />
      <Loader />
    </div>
  );
}
