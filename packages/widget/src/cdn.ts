// Point d'entrée CDN : lit la configuration sur la balise <script>
// <script src=".../frontnote.js" data-project="coress" data-api="https://..."></script>
import { initFrontNote } from './index'

const script = document.currentScript as HTMLScriptElement | null
const projectId = script?.dataset.project
const apiUrl = script?.dataset.api

if (projectId && apiUrl) {
  initFrontNote({ projectId, apiUrl })
} else {
  console.warn('[FrontNote] attributs data-project et data-api requis sur la balise <script>')
}
