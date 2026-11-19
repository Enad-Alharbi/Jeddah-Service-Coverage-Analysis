import { bootstrapApplication } from '@angular/platform-browser';
import config from '@arcgis/core/config.js';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { appConfig as secrets } from './environments/app-config';

// The ArcGIS key must be set before the first request (the basemap), so it happens before bootstrap.
config.apiKey = secrets.arcgisApiKey;

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
