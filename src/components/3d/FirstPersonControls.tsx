import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useShowroomStore } from '../../store/useShowroomStore';

export function FirstPersonControls() {
  const { camera, gl } = useThree();
  const { player, settings, viewMode, activeVehicleId, vehicles, updatePlayer, setViewMode, setActiveVehicle } = useShowroomStore();

  const isLockedRef = useRef(false);
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const isSprinting = useRef(false);

  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const headBobTimer = useRef(0);

  // Initial camera setup
  useEffect(() => {
    if (viewMode === 'showroom') {
      camera.position.set(player.position[0], player.position[1], player.position[2]);
      euler.current.set(player.rotation[0], player.rotation[1], player.rotation[2], 'YXZ');
      camera.quaternion.setFromEuler(euler.current);
    }
  }, [viewMode]);

  // Pointer lock handling
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      isLockedRef.current = locked;
      updatePlayer({ isPointerLocked: locked });
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isLockedRef.current || viewMode !== 'showroom') return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      const sens = settings.mouseSensitivity;
      const invert = settings.invertY ? -1 : 1;

      euler.current.y -= movementX * sens;
      euler.current.x -= movementY * sens * invert;

      // Limit vertical pitch (don't flip head over heels)
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));

      camera.quaternion.setFromEuler(euler.current);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (viewMode !== 'showroom') return;

      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveForward.current = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveBackward.current = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveLeft.current = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveRight.current = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          isSprinting.current = true;
          break;
        case 'KeyE': {
          const currentNearby = useShowroomStore.getState().player.nearbyVehicleId;
          if (currentNearby) {
            setActiveVehicle(currentNearby);
            setViewMode('inspection');
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
          }
          break;
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveForward.current = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveBackward.current = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveLeft.current = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveRight.current = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          isSprinting.current = false;
          break;
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gl, viewMode, settings, setActiveVehicle, setViewMode, updatePlayer]);

  // Frame tick: physics, movement, collision, proximity
  useFrame((_, delta) => {
    if (viewMode !== 'showroom') return;

    // Dampen delta to prevent physics explosion on tab-switching
    const dt = Math.min(delta, 0.1);

    // Friction / deceleration
    velocity.current.x -= velocity.current.x * 10.0 * dt;
    velocity.current.z -= velocity.current.z * 10.0 * dt;

    // Movement direction
    direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
    direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
    direction.current.normalize();

    const speedMultiplier = isSprinting.current ? 1.7 : 1.0;
    const currentSpeed = settings.walkSpeed * speedMultiplier * 40.0;

    if (moveForward.current || moveBackward.current) {
      velocity.current.z -= direction.current.z * currentSpeed * dt;
    }
    if (moveLeft.current || moveRight.current) {
      velocity.current.x -= direction.current.x * currentSpeed * dt;
    }

    const isMoving = moveForward.current || moveBackward.current || moveLeft.current || moveRight.current;

    // Apply movement relative to camera yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), euler.current.y);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), euler.current.y);

    const moveVector = new THREE.Vector3()
      .addScaledVector(forward, -velocity.current.z * dt)
      .addScaledVector(right, velocity.current.x * dt);

    const nextPos = camera.position.clone().add(moveVector);

    // Showroom Boundaries (Walls)
    const minX = -23, maxX = 23;
    const minZ = -19, maxZ = 21;
    nextPos.x = Math.max(minX, Math.min(maxX, nextPos.x));
    nextPos.z = Math.max(minZ, Math.min(maxZ, nextPos.z));

    // Platform & Vehicle Collision Prevention
    // Check distance against each car platform center
    vehicles.forEach(v => {
      const px = v.showroomPosition[0];
      const pz = v.showroomPosition[2];
      const dist = Math.hypot(nextPos.x - px, nextPos.z - pz);
      const minDistance = v.platformRadius - 0.3; // Can't walk inside the car chassis
      if (dist < minDistance && dist > 0.001) {
        // Push away to circle boundary
        const pushAngle = Math.atan2(nextPos.z - pz, nextPos.x - px);
        nextPos.x = px + Math.cos(pushAngle) * minDistance;
        nextPos.z = pz + Math.sin(pushAngle) * minDistance;
      }
    });

    // Head bob effect when walking
    let eyeHeight = 1.65;
    if (isMoving && isLockedRef.current) {
      headBobTimer.current += dt * (isSprinting.current ? 14 : 9);
      eyeHeight += Math.sin(headBobTimer.current) * 0.035;
    }
    nextPos.y = eyeHeight;

    camera.position.copy(nextPos);

    // Proximity detection for vehicles
    let closestVehicleId: string | null = null;
    let minVehicleDist = 6.0;

    vehicles.forEach(v => {
      const dist = Math.hypot(camera.position.x - v.showroomPosition[0], camera.position.z - v.showroomPosition[2]);
      if (dist < minVehicleDist) {
        minVehicleDist = dist;
        closestVehicleId = v.id;
      }
    });

    updatePlayer({
      position: [camera.position.x, camera.position.y, camera.position.z],
      rotation: [euler.current.x, euler.current.y, euler.current.z],
      isWalking: isMoving,
      isSprinting: isSprinting.current,
      nearbyVehicleId: closestVehicleId
    });
  });

  return null;
}
