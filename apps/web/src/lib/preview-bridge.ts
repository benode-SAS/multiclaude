import type { SelectionAnchor } from '@multiclaude/shared'

export type PreviewOut =
	| { type: 'mc-scroll'; ratio: number }
	| { type: 'mc-selection'; start: number; end: number; text: string }
	| { type: 'mc-selection-clear' }

export type PreviewIn =
	| { type: 'mc-apply-scroll'; ratio: number }
	| {
			type: 'mc-apply-selections'
			entries: Array<{ name: string; bg: string; fg: string; start: number; end: number }>
	  }

/**
 * Injected into the HTML preview. It runs inside `sandbox="allow-scripts"`
 * WITHOUT `allow-same-origin`, so the document sits in an opaque origin: it can
 * instrument itself and postMessage out, but cannot reach this app's DOM,
 * storage, cookies or same-origin API.
 */
export const BRIDGE_SCRIPT = `
(function () {
  var send = function (msg) { parent.postMessage(msg, '*') }

  var nodes = function () {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    var list = [], n
    while ((n = walker.nextNode())) list.push(n)
    return list
  }

  // Sonde plutôt que parcours de nœuds texte : un double ou triple clic renvoie
  // des bornes qui sont des éléments, qu'aucun parcours ne ferait correspondre.
  var offsetOf = function (node, offset) {
    var probe = document.createRange()
    probe.selectNodeContents(document.body)
    try { probe.setEnd(node, offset) } catch (e) { return null }
    return probe.toString().length
  }

  var rangeOf = function (start, end) {
    var range = document.createRange(), cursor = 0, started = false
    var list = nodes()
    for (var i = 0; i < list.length; i++) {
      var t = list[i], next = cursor + t.data.length
      if (!started && start <= next) { range.setStart(t, Math.max(0, start - cursor)); started = true }
      if (started && end <= next) { range.setEnd(t, Math.max(0, end - cursor)); return range }
      cursor = next
    }
    if (!started || list.length === 0) return null
    var last = list[list.length - 1]
    range.setEnd(last, last.data.length)
    return range
  }

  var ratio = function () {
    var el = document.scrollingElement || document.documentElement
    var span = el.scrollHeight - el.clientHeight
    return span > 0 ? el.scrollTop / span : 0
  }

  var applying = false
  window.addEventListener('scroll', function () {
    if (applying) return
    send({ type: 'mc-scroll', ratio: ratio() })
  }, { passive: true })

  document.addEventListener('selectionchange', function () {
    var sel = document.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return send({ type: 'mc-selection-clear' })
    var r = sel.getRangeAt(0)
    var from = offsetOf(r.startContainer, r.startOffset)
    var to = offsetOf(r.endContainer, r.endOffset)
    if (from === null) from = 0
    if (to === null) to = (document.body.textContent || '').length
    if (from === to) return send({ type: 'mc-selection-clear' })
    send({
      type: 'mc-selection',
      start: Math.min(from, to),
      end: Math.max(from, to),
      text: sel.toString().slice(0, 400),
    })
  })

  var style = document.createElement('style')
  document.head.appendChild(style)

  window.addEventListener('message', function (event) {
    var data = event.data
    if (!data || typeof data !== 'object') return

    if (data.type === 'mc-apply-scroll') {
      var el = document.scrollingElement || document.documentElement
      var span = el.scrollHeight - el.clientHeight
      if (span > 0) {
        applying = true
        el.scrollTop = data.ratio * span
        setTimeout(function () { applying = false }, 60)
      }
      return
    }

    if (data.type === 'mc-apply-selections') {
      if (!('highlights' in CSS)) return
      CSS.highlights.clear()
      var rules = []
      for (var i = 0; i < data.entries.length; i++) {
        var e = data.entries[i]
        var range = rangeOf(e.start, e.end)
        if (!range) continue
        CSS.highlights.set(e.name, new Highlight(range))
        rules.push('::highlight(' + e.name + '){background-color:' + e.bg + ';color:' + e.fg + ';}')
      }
      style.textContent = rules.join('')
    }
  })

  send({ type: 'mc-scroll', ratio: ratio() })
})()
`

/** Wraps the raw file so relative assets still resolve, then instruments it. */
export function buildPreviewDocument(html: string, baseHref: string) {
	// `</script>` échappé : sans ça, la balise fermerait sur place à l'injection.
	const bridge = BRIDGE_SCRIPT.replace(/<\/script/gi, '</script')
	return `<!doctype html><base href="${baseHref}">${html}<script>${bridge}</script>`
}

export const anchorFromPreview = (
	message: Extract<PreviewOut, { type: 'mc-selection' }>,
	filePath: string,
): SelectionAnchor => ({
	scope: 'viewer',
	key: filePath,
	start: message.start,
	end: message.end,
	text: message.text,
})
