import { generateLocalVacancy, assessAnswer } from '../../shared/domain.mjs'
import { test, expect } from '@playwright/test'
const answers = ['UX/UI-дизайнер, Middle', 'Проектирует интерфейсы, проводит исследования и проверяет продуктовые гипотезы.', 'Создаёт сервис найма для бизнес-заказчиков, отвечает за удобство интерфейса.', 'Продолжит текущий проект, улучшит онбординг и проведёт пользовательские тесты.', 'Нужны Figma, HTML, CSS и знания методов исследования пользователей.']
test.beforeEach(async ({page}) => {
 await page.route('**/api/generate-vacancy', async route => route.fulfill({json:{vacancy:generateLocalVacancy(route.request().postDataJSON().answers),source:'template',warning:'AI не подключён. Собран шаблон из ваших ответов.'}}))
 await page.route('**/api/analyze', async route => route.fulfill({json:{source:'rules',assessments:route.request().postDataJSON().answers.map((a:{questionId:number;rawText:string})=>({questionId:a.questionId,...assessAnswer(a.questionId,a.rawText)}))}}))
})
test('complete flow, edit, export, reload and reset', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
 await page.goto('/')
 await page.getByRole('button', {name:'Начать'}).click()
 await expect(page.getByRole('button', {name:'Далее', exact:true})).toBeDisabled()
 for (let i=0;i<5;i++) { await page.getByLabel('Ваш ответ', {exact:true}).fill(answers[i]); await page.getByRole('button', {name:i===4?'Проверить ответы':'Далее',exact:true}).click() }
 await expect(page.getByRole('heading', {name:'Всё верно?'})).toBeVisible()
 await page.getByRole('button', {name:'Проверить полноту',exact:true}).click()
 await expect(page.getByText('AI-проверка сейчас недоступна.',{exact:false})).toBeVisible()
 await page.getByRole('button', {name:'Собрать основу'}).click()
 await expect(page.getByText('Шаблон по ответам',{exact:true})).toBeVisible()
 await expect(page.locator('.vacancy-paper')).toContainText(answers[0])
 await page.getByRole('button', {name:'Редактировать текст'}).click()
 await page.getByLabel('Редактор вакансии').fill('# Моя вакансия\nПроверенный результат')
 const download = page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать .md'}).click(); expect((await download).suggestedFilename()).toBe('vacancy.md')
 await page.reload(); await expect(page.getByRole('heading',{name:'Моя вакансия'})).toBeVisible()
 await page.getByRole('button',{name:'К ответам'}).click()
 await page.getByRole('button',{name:'Изменить',exact:true}).first().click()
 await expect(page.getByLabel('Ваш ответ',{exact:true})).toHaveValue(answers[0])
 await page.reload(); await page.getByRole('button',{name:'Продолжить черновик'}).click()
 await expect(page.getByLabel('Ваш ответ',{exact:true})).toHaveValue(answers[0])
 await page.getByRole('button',{name:'Назад',exact:true}).click()
 await page.getByRole('button',{name:'Начать заново',exact:true}).click()
 await page.getByRole('button',{name:'Оставить черновик'}).click()
 await page.getByRole('button',{name:'Начать заново',exact:true}).click()
 await page.getByRole('button',{name:'Удалить и начать'}).click()
 await expect(page.getByRole('button',{name:'Начать'})).toBeVisible()
 expect(errors).toEqual([])
})
test('mobile fits viewport and offline API still produces a labelled draft', async ({page}) => {
 await page.setViewportSize({width:390,height:844}); await page.goto('/')
 await expect(page.getByRole('heading',{name:/Соберём основу вакансии/})).toBeVisible()
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
 await page.locator('main').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished))); await page.screenshot({path:'artifacts/mobile.png',fullPage:true})
 await page.getByRole('button',{name:'Начать'}).click()
 for (let i=0;i<5;i++) { await page.getByLabel('Ваш ответ',{exact:true}).fill(answers[i]); await page.getByRole('button',{name:i===4?'Проверить ответы':'Далее',exact:true}).click() }
 await page.route('**/api/generate-vacancy',route => route.abort())
 await page.getByRole('button',{name:'Собрать основу'}).click()
 await expect(page.getByText('Сервер недоступен.',{exact:false})).toBeVisible()
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
 await page.locator('main').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished))); await page.screenshot({path:'artifacts/result-mobile.png',fullPage:true})
})
test('API rejects incomplete input and non-POST requests', async ({request}) => {
 expect((await request.get('/api/generate-vacancy')).status()).toBe(405)
 expect((await request.post('/api/generate-vacancy',{data:{answers:[]}})).status()).toBe(400)
})
test('desktop welcome', async ({page}) => { await page.setViewportSize({width:1440,height:1000}); await page.goto('/'); await page.locator('main').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished))); await page.screenshot({path:'artifacts/desktop.png',fullPage:true}) })

test('speech session survives rerenders and stops before navigation', async ({page}) => {
 await page.addInitScript(() => {
  class FakeRecognition {
   lang=''; continuous=false; interimResults=false
   onstart: (()=>void)|null=null; onend: (()=>void)|null=null; onerror=null
   onresult: ((event: unknown)=>void)|null=null
   start() { this.onstart?.(); setTimeout(()=>this.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:'Проектирует интерфейсы и проводит исследования пользователей'}}]}),50) }
   stop() { this.onend?.() }
   abort() { this.onend?.() }
  }
  Object.defineProperty(window,'SpeechRecognition',{value:FakeRecognition,configurable:true})
 })
 await page.goto('/'); await page.getByRole('button',{name:'Начать'}).click()
 await page.getByRole('button',{name:'Ответить голосом'}).click()
 await expect(page.getByLabel('Ваш ответ',{exact:true})).toContainText('Проектирует интерфейсы')
 await expect(page.getByRole('button',{name:'Далее',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Остановить запись'}).click()
 await page.getByRole('button',{name:'Далее',exact:true}).click()
 await expect(page.getByLabel('Ваш ответ',{exact:true})).toHaveValue('')
})
test('cancelled generation does not replace the review with a late result', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.goto('/'); await page.getByRole('button',{name:'Начать'}).click()
 for (let i=0;i<5;i++) { await page.getByLabel('Ваш ответ',{exact:true}).fill(answers[i]); await page.getByRole('button',{name:i===4?'Проверить ответы':'Далее',exact:true}).click() }
 await page.route('**/api/generate-vacancy', async route => { await new Promise(resolve=>setTimeout(resolve,300)); await route.fulfill({json:{vacancy:'# Late result',source:'ai'}}).catch(()=>{}) })
 await page.getByRole('button',{name:'Собрать основу'}).click()
 await page.getByRole('button',{name:'Отменить и вернуться'}).click()
 await expect(page.getByRole('heading',{name:'Всё верно?'})).toBeVisible()
 await page.waitForTimeout(500)
 await expect(page.getByRole('heading',{name:'Всё верно?'})).toBeVisible()
})

test('legacy four-answer draft keeps answers and asks for the role first', async ({page}) => {
 await page.addInitScript(()=>localStorage.setItem('voice-vacancy-v2',JSON.stringify({texts:['Старые задачи','Старый проект','Старые планы','Старые навыки'],step:2,result:'# Старый результат'})))
 await page.goto('/');await page.getByRole('button',{name:'Продолжить черновик'}).click()
 await expect(page.getByRole('heading',{name:'На какую позицию вы ищете сотрудника?'})).toBeVisible()
 await expect(page.getByLabel('Ваш ответ',{exact:true})).toHaveValue('')
 await page.getByLabel('Ваш ответ',{exact:true}).fill('Дизайнер');await page.getByRole('button',{name:'Далее',exact:true}).click()
 await expect(page.getByLabel('Ваш ответ',{exact:true})).toHaveValue('Старые задачи')
 await expect(page.locator('header')).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0)
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax','5')
})
