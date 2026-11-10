import { sha256Hex } from '@/utils/sha256';

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe('sha256Hex', () => {
  test('matches standard vectors', () => {
    expect(sha256Hex(bytes(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(bytes('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  test('hashes UTF-8 input', () => {
    expect(sha256Hex(bytes('字节卡'))).toHaveLength(64);
  });
});
