import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import fredokaBoldUrl from './src/assets/fonts/Fredoka-Bold.ttf';

// Register Fredoka locally so it's available before first render
(function () {
  const style = document.createElement('style');
  style.textContent = "@font-face{font-family:'Fredoka';src:url('" + fredokaBoldUrl + "') format('truetype');font-weight:700;font-style:normal;}";
  document.head.appendChild(style);
}());

// Register the app for web
AppRegistry.registerComponent(appName, () => App);

// Start the app on web
AppRegistry.runApplication(appName, {
  initialProps: {},
  rootTag: document.getElementById('root'),
});




