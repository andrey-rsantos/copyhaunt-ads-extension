import { expect, test } from './fixtures'

test('exibe a página de boas-vindas construída pela extensão', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage()

  await page.goto(
    'chrome-extension://' + extensionId + '/src/boas-vindas/index.html',
  )

  await expect(
    page.getByRole('heading', { name: 'Pronto para caçar.' }),
  ).toBeVisible()
  await expect(page.getByText('Extensão instalada')).toBeVisible()
  await expect(page.locator('img[alt="CopyHaunt Ads"]')).toBeVisible()

  const cta = page.getByRole('link', {
    name: 'Abrir Biblioteca de Anúncios',
  })
  await expect(cta).toHaveAttribute(
    'href',
    'https://www.facebook.com/ads/library/',
  )
  await expect(cta).toHaveAttribute('target', '_blank')
})