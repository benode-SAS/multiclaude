import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { primeAudio } from './lib/sound.ts'
import { applyTheme, storedTheme } from './lib/theme.ts'
import './index.css'

// Before first paint, so the page never flashes the wrong palette.
applyTheme(storedTheme())

// Audio needs a gesture; arm the context on the first one.
for (const event of ['pointerdown', 'keydown'] as const) {
	window.addEventListener(event, () => primeAudio(), { once: true })
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
