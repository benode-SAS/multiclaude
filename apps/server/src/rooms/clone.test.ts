import { describe, expect, test } from 'bun:test'
import { authenticatedUrl, isCloneUrl } from './clone.ts'

describe('isCloneUrl', () => {
	for (const url of [
		'https://github.com/org/projet.git',
		'http://gitlab.interne/org/projet.git',
		'ssh://git@github.com/org/projet.git',
		'git@github.com:org/projet.git',
	]) {
		test(`accepte ${url}`, () => expect(isCloneUrl(url)).toBe(true))
	}

	for (const url of ['/etc/passwd', 'file:///etc', 'projet', 'https://a b/c', '']) {
		test(`refuse ${url || '(vide)'}`, () => expect(isCloneUrl(url)).toBe(false))
	}
})

describe('authenticatedUrl', () => {
	test('GitHub attend x-access-token comme utilisateur', () => {
		expect(authenticatedUrl('https://github.com/org/projet.git', 'ghp_abc')).toBe(
			'https://x-access-token:ghp_abc@github.com/org/projet.git',
		)
	})

	test('GitLab attend oauth2', () => {
		expect(authenticatedUrl('https://gitlab.com/org/projet.git', 'glpat_abc')).toBe(
			'https://oauth2:glpat_abc@gitlab.com/org/projet.git',
		)
	})

	test('Bitbucket attend x-token-auth', () => {
		expect(authenticatedUrl('https://bitbucket.org/org/projet.git', 'tok')).toBe(
			'https://x-token-auth:tok@bitbucket.org/org/projet.git',
		)
	})

	test('une forge inconnue reçoit git', () => {
		expect(authenticatedUrl('https://git.interne.fr/org/projet.git', 'tok')).toBe(
			'https://git:tok@git.interne.fr/org/projet.git',
		)
	})

	// A token holding @ or / would otherwise cut the URL in the wrong place.
	test('les caractères spéciaux du jeton sont encodés', () => {
		const url = authenticatedUrl('https://github.com/org/projet.git', 'a@b/c:d')
		expect(url).toBe('https://x-access-token:a%40b%2Fc%3Ad@github.com/org/projet.git')
		expect(new URL(url).host).toBe('github.com')
	})

	test('le port et le chemin sont préservés', () => {
		expect(authenticatedUrl('https://git.interne.fr:8443/a/b.git', 'tok')).toBe(
			'https://git:tok@git.interne.fr:8443/a/b.git',
		)
	})
})
