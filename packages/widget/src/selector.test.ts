// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { describeElement, getClickPosition, getSelector, readText } from './selector'

function page(html: string) {
  document.body.innerHTML = html
}

const roundTrip = (el: Element) => document.querySelector(getSelector(el))

describe('getSelector', () => {
  it('utilise un id unique', () => {
    page('<main><section id="hero"><h1>Titre</h1></section></main>')
    const h1 = document.querySelector('h1') as Element
    expect(getSelector(h1)).toBe('#hero > h1')
  })

  it('distingue les éléments frères de même type', () => {
    page('<ul><li>a</li><li>b</li><li>c</li></ul>')
    const second = document.querySelectorAll('li')[1] as Element
    expect(getSelector(second)).toBe('body > ul > li:nth-of-type(2)')
    expect(roundTrip(second)).toBe(second)
  })

  it('ignore un id dupliqué', () => {
    page('<div id="x"><p>1</p></div><div id="x"><p>2</p></div>')
    const p = document.querySelectorAll('p')[1] as Element
    expect(roundTrip(p)).toBe(p)
  })

  it('contourne les id atypiques', () => {
    page('<div id="1-bloc:a"><span>ok</span></div>')
    const span = document.querySelector('span') as Element
    expect(roundTrip(span)).toBe(span)
  })
})

describe('getClickPosition', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 } as DOMRect

  it('donne la fraction dans l’élément', () => {
    expect(getClickPosition(rect, 150, 75)).toEqual({ x: 0.25, y: 0.25 })
  })

  it('reste dans les bornes 0 à 1', () => {
    expect(getClickPosition(rect, 0, 999)).toEqual({ x: 0, y: 1 })
  })

  it('centre si l’élément n’a pas de taille', () => {
    expect(getClickPosition({ ...rect, width: 0, height: 0 } as DOMRect, 1, 1)).toEqual({
      x: 0.5,
      y: 0.5,
    })
  })
})

describe('describeElement / readText', () => {
  it('décrit un élément pour le champ zone', () => {
    page(`<h2>  Nos   chambres </h2><img alt="Vue sur la forêt"><div></div>
      <p>${'Un très long paragraphe '.repeat(5)}</p>`)
    const [h2, img, div, p] = ['h2', 'img', 'div', 'p'].map((t) => document.querySelector(t)!)
    expect(readText(h2!)).toBe('Nos chambres')
    expect(describeElement(h2!)).toBe('titre « Nos chambres »')
    expect(describeElement(img!)).toBe('image « Vue sur la forêt »')
    expect(describeElement(div!)).toBe('bloc')
    expect(describeElement(p!)).toMatch(/^paragraphe « Un très long .*… »$/)
  })
})
