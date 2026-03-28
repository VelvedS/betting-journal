import { useEffect, useRef, useCallback } from 'react';
import { Dimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Matter from 'matter-js';
import * as Haptics from 'expo-haptics';

const { Engine, Bodies, Body, Constraint, Composite } = Matter;

const TICKET_WIDTH = 145;
const TICKET_HEIGHT = 48;

interface BodyPosition {
  x: number;
  y: number;
  angle: number;
}

export function usePhysicsWorld(ticketCount: number) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const bodyPositions = useSharedValue<BodyPosition[]>(
    Array.from({ length: ticketCount }, () => ({ x: 0, y: 0, angle: 0 }))
  );
  const draggedIndex = useSharedValue(-1);

  const engineRef = useRef<Matter.Engine | null>(null);
  const bodiesRef = useRef<Matter.Body[]>([]);
  const constraintRef = useRef<Matter.Constraint | null>(null);
  const dragPointRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;

    // Walls (thick rectangles positioned off-screen)
    const wallT = 100;
    const walls = [
      // top
      Bodies.rectangle(screenWidth / 2, -wallT / 2, screenWidth + wallT * 2, wallT, { isStatic: true }),
      // bottom
      Bodies.rectangle(screenWidth / 2, screenHeight + wallT / 2, screenWidth + wallT * 2, wallT, { isStatic: true }),
      // left
      Bodies.rectangle(-wallT / 2, screenHeight / 2, wallT, screenHeight + wallT * 2, { isStatic: true }),
      // right
      Bodies.rectangle(screenWidth + wallT / 2, screenHeight / 2, wallT, screenHeight + wallT * 2, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);

    // Create ticket bodies in a staggered grid
    const cols = 3;
    const rows = Math.ceil(ticketCount / cols);
    const usableW = screenWidth - 30;
    const usableH = screenHeight * 0.52;
    const startY = 90;
    const xSpacing = usableW / cols;
    const ySpacing = usableH / rows;

    const bodies: Matter.Body[] = [];
    for (let i = 0; i < ticketCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const stagger = row % 2 === 1 ? xSpacing * 0.25 : 0;
      const x = 15 + xSpacing * (col + 0.5) + stagger + (Math.random() - 0.5) * 15;
      const y = startY + ySpacing * (row + 0.5) + (Math.random() - 0.5) * 10;
      const angle = (Math.random() - 0.5) * 0.3;

      const body = Bodies.rectangle(x, y, TICKET_WIDTH, TICKET_HEIGHT, {
        chamfer: { radius: 10 },
        restitution: 0.4,
        friction: 0.06,
        frictionAir: 0.05,
        density: 0.0012,
        angle,
      });

      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 0.6,
        y: (Math.random() - 0.5) * 0.6,
      });

      bodies.push(body);
    }

    Composite.add(engine.world, bodies);
    bodiesRef.current = bodies;

    // Set initial positions
    bodyPositions.value = bodies.map((b) => ({
      x: b.position.x,
      y: b.position.y,
      angle: b.angle,
    }));

    // Physics loop
    let slowFrameCount = 0;
    let frictionReduced = false;

    const step = (time: number) => {
      const rawDelta =
        lastTimeRef.current === 0 ? 16.67 : time - lastTimeRef.current;
      const delta = Math.min(rawDelta, 32);
      lastTimeRef.current = time;

      // Performance guard — lighten simulation on slow devices
      if (rawDelta > 32) {
        slowFrameCount++;
        if (slowFrameCount > 5 && !frictionReduced) {
          frictionReduced = true;
          console.warn(
            '[PhysicsWorld] Slow frames detected (>5 consecutive >32ms) — increasing frictionAir to 0.07'
          );
          for (const b of bodies) {
            if (!b.isStatic) b.frictionAir = 0.07;
          }
        }
      } else {
        slowFrameCount = 0;
      }

      // Micro drift forces to keep things gently moving
      for (const body of bodies) {
        if (body.isStatic) continue;
        const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
        if (speed < 0.2) {
          Body.applyForce(body, body.position, {
            x: (Math.random() - 0.5) * 0.00004,
            y: (Math.random() - 0.5) * 0.00004,
          });
        }
        if (Math.abs(body.angularVelocity) < 0.001) {
          Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.002);
        }
      }

      // Update constraint target for dragging
      if (constraintRef.current) {
        (constraintRef.current as any).pointA = {
          x: dragPointRef.current.x,
          y: dragPointRef.current.y,
        };
      }

      Engine.update(engine, delta);

      // Write positions to shared values
      bodyPositions.value = bodies.map((b) => ({
        x: b.position.x,
        y: b.position.y,
        angle: b.angle,
      }));

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      engineRef.current = null;
      bodiesRef.current = [];
      constraintRef.current = null;
    };
  }, []);

  const startDrag = useCallback((index: number, x: number, y: number) => {
    const body = bodiesRef.current[index];
    if (!body || !engineRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    dragPointRef.current = { x, y };
    draggedIndex.value = index;

    const constraint = Constraint.create({
      pointA: { x, y },
      bodyB: body,
      pointB: { x: 0, y: 0 },
      stiffness: 0.3,
      damping: 0.2,
      length: 0,
    });

    constraintRef.current = constraint;
    Composite.add(engineRef.current.world, constraint);
  }, []);

  const updateDrag = useCallback((x: number, y: number) => {
    dragPointRef.current = { x, y };
  }, []);

  const endDrag = useCallback((velocityX: number, velocityY: number) => {
    const idx = draggedIndex.value;

    if (constraintRef.current && engineRef.current) {
      Composite.remove(engineRef.current.world, constraintRef.current);
      constraintRef.current = null;
    }

    if (idx >= 0 && bodiesRef.current[idx]) {
      const speed = Math.sqrt(velocityX ** 2 + velocityY ** 2);
      if (speed > 500) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Body.setVelocity(bodiesRef.current[idx], {
        x: velocityX / 150,
        y: velocityY / 150,
      });
    }

    draggedIndex.value = -1;
  }, []);

  return {
    bodyPositions,
    draggedIndex,
    startDrag,
    updateDrag,
    endDrag,
    ticketWidth: TICKET_WIDTH,
    ticketHeight: TICKET_HEIGHT,
  };
}
