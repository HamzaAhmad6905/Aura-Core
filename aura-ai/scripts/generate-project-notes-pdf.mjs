import fs from 'node:fs'
import PDFDocument from 'pdfkit'

const source = fs.readFileSync(new URL('../docs/AURA_PROJECT_NOTES.md', import.meta.url), 'utf8')
const output = new URL('../docs/AURA_PROJECT_NOTES.pdf', import.meta.url)
const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true, info: { Title: 'Aura AI Project Notes', Author: 'Aura AI Project' } })
doc.pipe(fs.createWriteStream(output))

doc.fillColor('#111827').font('Helvetica-Bold').fontSize(22).text('Aura AI Project Notes', { paragraphGap: 8 })
doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text('Project architecture, current features, limitations, and next development plan', { paragraphGap: 18 })

for (const line of source.split(/\r?\n/).slice(4)) {
  if (line.startsWith('# ')) doc.fillColor('#111827').font('Helvetica-Bold').fontSize(17).text(line.slice(2), { paragraphGap: 8 })
  else if (line.startsWith('## ')) doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(13).text(line.slice(3), { paragraphGap: 5 })
  else if (line.startsWith('### ')) doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10).text(line.slice(4), { paragraphGap: 3 })
  else if (line.startsWith('- ')) doc.fillColor('#1f2937').font('Helvetica').fontSize(9.5).text(`• ${line.slice(2)}`, { indent: 10, paragraphGap: 2 })
  else if (line.startsWith('```')) continue
  else if (line.trim()) doc.fillColor('#1f2937').font('Helvetica').fontSize(9.5).text(line, { paragraphGap: 4, lineGap: 2 })
  else doc.moveDown(0.35)
}

const range = doc.bufferedPageRange()
for (let index = range.start; index < range.start + range.count; index += 1) {
  doc.switchToPage(index)
  doc.fillColor('#6b7280').fontSize(8).text(`Aura AI Project Notes  |  ${index + 1} / ${range.count}`, 52, 810, { align: 'center', width: 491 })
}
doc.end()
