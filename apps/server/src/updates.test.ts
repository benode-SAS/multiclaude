import { describe, expect, test } from 'bun:test'
import { isNewer } from './updates.ts'

describe('isNewer', () => {
	const newer: Array<[string, string]> = [
		['0.2.0', '0.1.0'],
		['1.0.0', '0.9.9'],
		['0.1.1', '0.1.0'],
		['0.10.0', '0.9.0'],
		['1.2.3', '1.2.2'],
	]
	for (const [candidate, current] of newer) {
		test(`${candidate} > ${current}`, () => expect(isNewer(candidate, current)).toBe(true))
	}

	const notNewer: Array<[string, string]> = [
		['0.1.0', '0.1.0'],
		['0.1.0', '0.2.0'],
		['0.9.0', '0.10.0'],
		['1.2.2', '1.2.3'],
	]
	for (const [candidate, current] of notNewer) {
		test(`${candidate} !> ${current}`, () => expect(isNewer(candidate, current)).toBe(false))
	}

	// GitHub tags carry a leading v; comparing the strings would order them wrong.
	test('the leading v is ignored', () => {
		expect(isNewer('v0.2.0', '0.1.0')).toBe(true)
		expect(isNewer('v0.1.0', 'v0.1.0')).toBe(false)
	})

	// A release named anything else must never raise a false alarm.
	test('an unparseable tag never claims an update', () => {
		expect(isNewer('bun-v1.3.14', '0.1.0')).toBe(false)
		expect(isNewer('nightly', '0.1.0')).toBe(false)
		expect(isNewer('', '0.1.0')).toBe(false)
	})

	// Pre-release suffixes are read up to the numbers, so 0.2.0-rc.1 counts as 0.2.0.
	test('a pre-release suffix does not break the comparison', () => {
		expect(isNewer('0.2.0-rc.1', '0.1.0')).toBe(true)
	})
})
