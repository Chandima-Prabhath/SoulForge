/**
 * ECS World & Components — pure TypeScript, no rendering dependencies.
 *
 * This is the foundation of the Game Core. It must remain engine-agnostic
 * so it can run identically in browser, Node, and (later) on a Colyseus server.
 *
 * Phase 0 scope: just enough ECS to support a movable character on a tilemap.
 *
 * bitECS pattern: the world is just an entity manager. Components are
 * standalone typed arrays. Systems query components directly.
 */

import { createWorld, defineComponent, Types, type IWorld } from "bitecs";

export const world = createWorld();

/**
 * World-space pixel position.
 * Origin (0,0) is the top-left corner of the tilemap's bounding box.
 */
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Velocity in pixels per second.
 */
export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Sprite reference — just an integer ID into the renderer's sprite registry.
 * The renderer resolves this ID to an actual Pixi display object.
 * Game Core never touches Pixi.
 */
export const Sprite = defineComponent({
  spriteId: Types.ui8, // index into SpriteRegistry
  zLayer: Types.ui8, // 0 = ground, 1 = object, 2 = character, 3 = vfx
});

/**
 * Marks an entity as the player. Tag component (no data).
 */
export const PlayerTag = defineComponent({});

/**
 * Marks an entity for the camera to follow. Tag component.
 */
export const CameraTargetTag = defineComponent({});

/**
 * Click-to-move target. When active, the movement system steers toward this point.
 * The `active` flag distinguishes "no target" from "target at (0,0)".
 */
export const MoveTarget = defineComponent({
  x: Types.f32,
  y: Types.f32,
  active: Types.ui8, // 0 = inactive, 1 = active
});

export type World = IWorld;
