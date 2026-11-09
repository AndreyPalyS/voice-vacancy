import { chromium } from '@playwright/test'
import { mkdir, rename } from 'node:fs/promises'
await mkdir('artifacts', {recursive:true})
const browser = await chromium.launch({channel:'chrome',headless:true,slowMo:280})
const context = await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:'artifacts/video-tmp',size:{width:1440,height:960}}})
const page = await context.newPage()
await page.goto('http://127.0.0.1:4173')
await page.waitForTimeout(1500)
await page.getByRole('button',{name:'Начать'}).click()
const answers = ['UX/UI-дизайнер, Middle', 'Проектирует интерфейсы, проводит интервью с пользователями и проверяет гипотезы.', 'Разрабатывает сервис автоматического найма, отвечает за удобство работы бизнес-заказчика.', 'Продолжит текущий проект: улучшит онбординг и запустит тестирование прототипов с клиентами.', 'Нужны Figma, HTML, CSS, прототипирование и знание методов исследования пользователей.']
for(let i=0;i<5;i++){
 await page.getByLabel('Ваш ответ',{exact:true}).fill(answers[i]); await page.waitForTimeout(1000)
 await page.getByRole('button',{name:i===4?'Проверить ответы':'Далее',exact:true}).click()
}
await page.waitForTimeout(1200)
await page.getByRole('button',{name:'Проверить полноту',exact:true}).click()
await page.getByText('AI-проверка сейчас недоступна.',{exact:false}).waitFor()
await page.waitForTimeout(1200)
await page.getByRole('button',{name:'Собрать основу'}).click()
await page.locator('.vacancy-paper').waitFor()
await page.waitForTimeout(1500)
await page.getByRole('button',{name:'Редактировать текст'}).click()
await page.getByLabel('Редактор вакансии').fill((await page.getByLabel('Редактор вакансии').inputValue()).replace('[уточнить название роли]','UX/UI-дизайнер'))
await page.getByRole('button',{name:'Показать превью'}).click()
await page.getByRole('button',{name:'Скачать .md'}).click()
await page.waitForTimeout(1600)
const video=page.video(); await context.close(); await rename(await video.path(),'artifacts/demo.webm'); await browser.close()
console.log('Recorded artifacts/demo.webm')
