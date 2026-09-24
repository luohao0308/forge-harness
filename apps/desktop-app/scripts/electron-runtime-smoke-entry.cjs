const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  const preferences = window.webContents.getLastWebPreferences?.() || {}
  if (preferences.nodeIntegration !== false
    || preferences.contextIsolation !== true
    || preferences.sandbox !== true) {
    throw new Error('Electron security preferences are not enforced')
  }
  console.log(JSON.stringify({ electron: process.versions.electron, security: 'ok' }))
  window.destroy()
  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})
