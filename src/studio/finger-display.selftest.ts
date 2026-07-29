import { FINGER_CODES } from '../lib/types.ts';
import {
  FINGER_DISPLAY_SCALE,
  fingerDisplayRatio,
  fingerDisplayScale,
} from './finger-display.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`finger-display.selftest FAIL: ${message}`);
}

assert(FINGER_CODES.length === 10, 'ten finger codes are covered');
for (const finger of FINGER_CODES) {
  assert(Number.isFinite(fingerDisplayScale(finger)), `${finger} has a finite scale`);
  assert(fingerDisplayRatio(finger) > 0 && fingerDisplayRatio(finger) <= 1, `${finger} fits max envelope`);
}

assert(fingerDisplayScale('L1') === fingerDisplayScale('R1'), 'thumbs are symmetric');
assert(fingerDisplayScale('L2') === fingerDisplayScale('R2'), 'index fingers are symmetric');
assert(fingerDisplayScale('L3') === fingerDisplayScale('R3'), 'middle fingers are symmetric');
assert(fingerDisplayScale('L4') === fingerDisplayScale('R4'), 'ring fingers are symmetric');
assert(fingerDisplayScale('L5') === fingerDisplayScale('R5'), 'pinkies are symmetric');

assert(FINGER_DISPLAY_SCALE.thumb > FINGER_DISPLAY_SCALE.middle, 'thumb is larger than middle');
assert(FINGER_DISPLAY_SCALE.middle > FINGER_DISPLAY_SCALE.index, 'middle is larger than index');
assert(FINGER_DISPLAY_SCALE.index > FINGER_DISPLAY_SCALE.ring, 'index is larger than ring');
assert(FINGER_DISPLAY_SCALE.ring > FINGER_DISPLAY_SCALE.pinky, 'ring is larger than pinky');
assert(fingerDisplayRatio('L1') === 1, 'thumb defines the fixed maximum envelope');

console.log('finger-display.selftest — all passed');
