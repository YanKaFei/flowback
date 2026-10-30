export default defineAppConfig({
  pages: [
    'pages/import/index',
    'pages/review/index',
    'pages/tasks/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: 'FlowBack',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FFFFFF',
    navigationStyle: 'custom',
  },
  tabBar: {
    color: '#9B9B94',
    selectedColor: '#4F6B14',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/import/index',
        text: '导入',
        iconPath: 'assets/tab-import.png',
        selectedIconPath: 'assets/tab-import-active.png',
      },
      {
        pagePath: 'pages/tasks/index',
        text: '任务',
        iconPath: 'assets/tab-tasks.png',
        selectedIconPath: 'assets/tab-tasks-active.png',
      },
    ],
  },
})
