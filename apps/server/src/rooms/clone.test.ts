import { describe, expect, test } from 'bun:test'
import { authenticatedUrl, isCloneUrl } from './clone.ts'

describe('isCloneUrl', () => {
	for (const url of [
		'https://github.com/org/projet.git',
		'http://gitlab.interne/org/projet.git',
		'ssh://git@github.com/org/projet.git',
		'git@github.com:org/projet.git',
	]) {
		test(`accepts ${url}`, () => expect(isCloneUrl(url)).toBe(true))
	}

	for (const url of ['/etc/passwd', 'file:///etc', 'projet', 'https://a b/c', '']) {
		test(`rejects ${url || '(empty)'}`, () => expect(isCloneUrl(url)).toBe(false))
	}
})

describe('authenticatedUrl', () => {
	test('GitHub expects x-access-token as the username', () => {
		expect(authenticatedUrl('https://github.com/org/projet.git', 'ghp_abc')).toBe(
			'https://x-access-token:ghp_abc@github.com/org/projet.git',
		)
	})

	test('GitLab expects oauth2', () => {
		expect(authenticatedUrl('https://gitlab.com/org/projet.git', 'glpat_abc')).toBe(
			'https://oauth2:glpat_abc@gitlab.com/org/projet.git',
		)
	})

	test('Bitbucket expects x-token-auth', () => {
		expect(authenticatedUrl('https://bitbucket.org/org/projet.git', 'tok')).toBe(
			'https://x-token-auth:tok@bitbucket.org/org/projet.git',
		)
	})

	test('an unknown forge gets git', () => {
		expect(authenticatedUrl('https://git.interne.fr/org/projet.git', 'tok')).toBe(
			'https://git:tok@git.interne.fr/org/projet.git',
		)
	})

	// A token holding @ or / would otherwise cut the URL in the wrong place.
	test('special characters in the token are encoded', () => {
		const url = authenticatedUrl('https://github.com/org/projet.git', 'a@b/c:d')
		expect(url).toBe('https://x-access-token:a%40b%2Fc%3Ad@github.com/org/projet.git')
		expect(new URL(url).host).toBe('github.com')
	})

	test('port and path are preserved', () => {
		expect(authenticatedUrl('https://git.interne.fr:8443/a/b.git', 'tok')).toBe(
			'https://git:tok@git.interne.fr:8443/a/b.git',
		)
	})
})
