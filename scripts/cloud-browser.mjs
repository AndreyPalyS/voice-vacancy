import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'chrome',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'artifacts/cloud-video',size:{width:1440,height:1000}}})
const page=await context.newPage()
try {
 await page.goto('http://127.0.0.1:4173')
 await page.getByRole('button',{name:'Начать'}).click()
 await page.getByLabel('Ваш ответ',{exact:true}).fill('UX/UI-дизайнер, Middle')
 await page.getByRole('button',{name:'Далее',exact:true}).click()
 const rest=['Проектирует интерфейсы, проводит интервью и проверяет продуктовые гипотезы.','Работает над сервисом автоматического найма, отвечает за интерфейс бизнес-заказчика.','Продолжит текущий проект: улучшит онбординг и протестирует прототипы с клиентами.','Нужны Figma, HTML, CSS, прототипирование и методы исследования пользователей.']
 for(let i=0;i<4;i++){await page.getByLabel('Ваш ответ',{exact:true}).fill(rest[i]);await page.getByRole('button',{name:i===3?'Проверить ответы':'Далее',exact:true}).click()}
 const analyzed=page.waitForResponse(r=>r.url().endsWith('/api/analyze'))
 await page.getByRole('button',{name:'Проверить полноту',exact:true}).click()
 assert.equal((await (await analyzed).json()).source,'ai')
 const generated=page.waitForResponse(r=>r.url().endsWith('/api/generate-vacancy'))
 await page.getByRole('button',{name:'Собрать основу'}).click()
 const data=await (await generated).json();assert.equal(data.source,'ai')
 await page.getByText('AI-черновик',{exact:true}).waitFor()
 await page.locator('main').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)))
 await page.screenshot({path:'artifacts/ai-result.png',fullPage:true})
 await page.getByRole('button',{name:'Редактировать текст'}).click()
 const editor=page.getByLabel('Редактор вакансии');await editor.fill((await editor.inputValue())+'\nПроверено заказчиком.')
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать .md'}).click();await(await download).saveAs('artifacts/ai-vacancy.md')
 await page.reload();await page.getByText('Проверено заказчиком.',{exact:false}).waitFor()
 console.log('PASS: UI five answers → real semantic AI → real generation → edit → export → reload')
}finally{await context.close();await browser.close()}
