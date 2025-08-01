import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { resolvePath, existFile, getCodeByPath } from '../src/utils';
import {
  loadConfigFile,
  resolveMarkConfig,
  resolveExtractConfig
} from '../src/config';
import { I18nImportType } from '../src/shared/types';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('url', () => ({ pathToFileURL: vi.fn() }));
vi.mock('../src/utils', () => ({
  resolvePath: vi.fn(),
  existFile: vi.fn(),
  getCodeByPath: vi.fn()
}));

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockPathToFileURL = vi.mocked(pathToFileURL);
const mockResolvePath = vi.mocked(resolvePath);
const mockExistFile = vi.mocked(existFile);
const mockGetCodeByPath = vi.mocked(getCodeByPath);

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolvePath.mockImplementation((path) => `/resolved/${path}`);
    mockPath.resolve.mockImplementation((...args) => args.join('/'));
    mockPath.extname.mockImplementation((filePath) => {
      const parts = filePath.split('.');
      return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
    });
    mockExistFile.mockReturnValue(true);
    mockGetCodeByPath.mockReturnValue('{}');
  });
  

  describe('resolveMarkConfig', () => {
    it('应该正确解析基础标记配置', () => {
      const config = resolveMarkConfig({
        include: ['src/**/*.js'],
        i18nTag: 'i18n'
      });
      
      expect(config.i18nTag).toBe('i18n');
      expect(config.ignoreComment).toBe('i18n-ignore');
      expect(config.include).toEqual(['/resolved/src/**/*.js']);
    });

    it('应该正确解析完整标记配置', () => {
      const config = resolveMarkConfig({
        include: ['src/**/*.{js,ts,vue}'],
        exclude: ['**/test/**', '**/dist/**'],
        staged: true,
        i18nTag: 'translate',
        i18nImport: '@/utils/i18n',
        ignoreComment: 'skip-i18n',
        ignoreAttrs: ['data-test', 'aria-label']
      });
      
      expect(config.i18nTag).toBe('translate');
      expect(config.i18nImport).toBe('@/utils/i18n');
      expect(config.ignoreComment).toBe('skip-i18n');
      expect(config.ignoreAttrs).toEqual(['data-test', 'aria-label']);
      expect(config.staged).toBe(true);
      expect(config.include).toEqual(['/resolved/src/**/*.{js,ts,vue}']);
      expect(config.exclude).toEqual(['/resolved/**/test/**', '/resolved/**/dist/**']);
    });

    it('应该正确解析i18nImport对象配置', () => {
      const importConfig = {
        path: '@/i18n',
        type: I18nImportType.NAMED,
        name: 'i18n'
      };
      
      const config = resolveMarkConfig({
        include: ['src/**/*.js'],
        i18nTag: 'i18n',
        i18nImport: importConfig
      });
      
      expect(config.i18nImport).toEqual(importConfig);
    });

    it('应该使用默认配置值', () => {
      const config = resolveMarkConfig({
        i18nTag: 'i18n'
      });
      
      expect(config.include).toEqual(['/resolved/src/**/*.{js,ts,jsx,tsx,mjs,vue}']);
      expect(config.exclude).toEqual([
        '/resolved/**/node_modules/**',
        '/resolved/**/dist/**',
        '/resolved/**/test/**',
        '/resolved/**/tests/**'
      ]);
      expect(config.staged).toBe(false);
      expect(config.ignoreComment).toBe('i18n-ignore');
    });

    it('应该验证必需配置项', () => {
      expect(() => resolveMarkConfig({ include: [], i18nTag: '' }))
        .toThrow('Missing required config: i18nTag');
    });
  });

  describe('resolveExtractConfig', () => {
    it('应该正确解析基础提取配置', () => {
      const config = resolveExtractConfig({
        include: ['src/**/*.js'],
        i18nTag: 'i18n',
        localeDir: './locales',
        langs: ['zh', 'en'],
        fileMapping: 'mapping'
      });
      
      expect(config.i18nTag).toBe('i18n');
      expect(config.localeDir).toBe('/resolved/./locales');
      expect(config.langs).toEqual(['zh', 'en']);
      expect(config.fileMapping).toBe('mapping');
      expect(config.placeholder).toEqual(['{', '}']);
    });

    it('应该正确解析完整提取配置', () => {
      const config = resolveExtractConfig({
        include: ['src/**/*.{js,ts,vue}'],
        exclude: ['**/test/**'],
        staged: true,
        i18nTag: 'translate',
        localeDir: './i18n/locales',
        langs: ['zh', 'en', 'fr', 'ja'],
        fileMapping: 'customMapping',
        placeholder: ['{{', '}}'],
      });
      
      expect(config.i18nTag).toBe('translate');
      expect(config.localeDir).toBe('/resolved/./i18n/locales');
      expect(config.langs).toEqual(['zh', 'en', 'fr', 'ja']);
      expect(config.fileMapping).toBe('customMapping');
      expect(config.placeholder).toEqual(['{{', '}}']);
      expect(config.staged).toBe(true);
      expect(config.include).toEqual(['/resolved/src/**/*.{js,ts,vue}']);
      expect(config.exclude).toEqual(['/resolved/**/test/**']);
    });

    it('应该使用默认配置值', () => {
      const config = resolveExtractConfig({
        i18nTag: 'i18n',
        localeDir: './locales',
        langs: ['zh'],
        fileMapping: 'mapping'
      });
      
      expect(config.include).toEqual(['/resolved/src/**/*.{js,ts,jsx,tsx,mjs,vue}']);
      expect(config.exclude).toEqual([
        '/resolved/**/node_modules/**',
        '/resolved/**/dist/**',
        '/resolved/**/test/**',
        '/resolved/**/tests/**'
      ]);
      expect(config.staged).toBe(false);
      expect(config.ignoreComment).toBe('i18n-ignore');
      expect(config.placeholder).toEqual(['{', '}']);
    });

    it('应该验证必需配置项', () => {
      const baseConfig = { include: ['src/**/*.js'], i18nTag: 'i18n', localeDir: './locales', langs: ['zh'], fileMapping: 'mapping' };
      
      expect(() => resolveExtractConfig({ ...baseConfig, i18nTag: '' }))
        .toThrow('Missing required config: i18nTag');
      expect(() => resolveExtractConfig({ ...baseConfig, localeDir: '' }))
        .toThrow('Missing required config: localeDir');
      expect(() => resolveExtractConfig({ ...baseConfig, langs: undefined }))
        .toThrow('Missing required config: langs');
      expect(() => resolveExtractConfig({ ...baseConfig, fileMapping: undefined }))
        .toThrow('Missing required config: fileMapping');
    });

    it('应该验证placeholder配置', () => {
      const baseConfig = { i18nTag: 'i18n', localeDir: './locales', langs: ['zh'], fileMapping: 'mapping' };
      
      expect(() => resolveExtractConfig({ ...baseConfig, placeholder: [] as any }))
        .toThrow('Missing required config: placeholder must be array and length > 0');
      expect(() => resolveExtractConfig({ ...baseConfig, placeholder: undefined }))
        .toThrow('Missing required config: placeholder must be array and length > 0');
    });
  });

  describe('loadConfigFile', () => {
    it('应该加载JSON配置文件', async () => {
      const configContent = {
        include: ['src/**/*.js'],
        i18nTag: 'i18n',
        localeDir: './locales',
        langs: ['zh', 'en']
      };
      
      mockExistFile.mockReturnValue(true);
      mockGetCodeByPath.mockReturnValue(JSON.stringify(configContent));
      
      const config = await loadConfigFile('/path/to/config.json');
      
      expect(config).toEqual(configContent);
    });

    it('应该加载完整配置文件', async () => {
      const configContent = {
        include: ['src/**/*.{js,ts,vue}'],
        exclude: ['**/test/**'],
        staged: true,
        i18nTag: 'translate',
        i18nImport: '@/utils/i18n',
        ignoreComment: 'skip-i18n',
        ignoreAttrs: ['data-test'],
        localeDir: './i18n/locales',
        langs: ['zh', 'en', 'fr'],
        fileMapping: 'customMapping',
        placeholder: ['{{', '}}']
      };
      
      mockExistFile.mockReturnValue(true);
      mockGetCodeByPath.mockReturnValue(JSON.stringify(configContent));
      
      const config = await loadConfigFile('/path/to/full-config.json');
      
      expect(config).toEqual(configContent);
      expect(config.include).toEqual(['src/**/*.{js,ts,vue}']);
      expect(config.exclude).toEqual(['**/test/**']);
      expect(config.staged).toBe(true);
      expect(config.i18nTag).toBe('translate');
      expect(config.i18nImport).toBe('@/utils/i18n');
      expect(config.ignoreComment).toBe('skip-i18n');
      expect(config.ignoreAttrs).toEqual(['data-test']);
      expect(config.localeDir).toBe('./i18n/locales');
      expect(config.langs).toEqual(['zh', 'en', 'fr']);
      expect(config.fileMapping).toBe('customMapping');
      expect(config.placeholder).toEqual(['{{', '}}']);
    });

    it('应该返回默认配置当没有找到配置文件时', async () => {
      mockExistFile.mockReturnValue(false);
      
      const config = await loadConfigFile();
      
      expect(config).toHaveProperty('include');
      expect(config).toHaveProperty('i18nTag');
      expect(config).toHaveProperty('localeDir');
      expect(config).toHaveProperty('langs');
      expect(config.include).toEqual(['src/**/*']);
      expect(config.exclude).toEqual(['**/node_modules/**', '**/dist/**', '**/test/**', '**/tests/**']);
      expect(config.i18nTag).toBe('i18n');
      expect(config.localeDir).toBe('./src/locale/');
      expect(config.langs).toEqual(['zh', 'en']);
    });

    it('应该处理相对路径配置文件', async () => {
      const configContent = { i18nTag: 'i18n' };
      
      mockExistFile.mockReturnValue(true);
      mockGetCodeByPath.mockReturnValue(JSON.stringify(configContent));
      
      const config = await loadConfigFile('./config.json');
      
      expect(config).toEqual(configContent);
      expect(mockResolvePath).toHaveBeenCalledWith('./config.json');
    });

    it('应该处理不存在的配置文件', async () => {
      mockExistFile.mockReturnValue(false);
      
      await expect(loadConfigFile('/path/to/non-existing.json'))
        .rejects.toThrow('not found config file: /resolved//path/to/non-existing.json');
    });

    it('应该处理JSON解析错误', async () => {
      mockExistFile.mockReturnValue(true);
      mockGetCodeByPath.mockReturnValue('invalid json');
      
      await expect(loadConfigFile('/path/to/config.json'))
        .rejects.toThrow('load config file failed');
    });

    it('应该处理不支持的文件格式', async () => {
      mockExistFile.mockReturnValue(true);
      
      await expect(loadConfigFile('/path/to/config.yaml'))
        .rejects.toThrow('not supported config file format: .yaml');
    });
  });
});