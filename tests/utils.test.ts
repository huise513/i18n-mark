import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('micromatch');
vi.mock('node:child_process');
vi.mock('glob', () => ({
  globSync: vi.fn()
}));
vi.mock('node:child_process', () => ({
  execSync: vi.fn()
}));
vi.mock('micromatch', () => ({
  default: vi.fn()
}));

// Import mocked functions
import { globSync } from 'glob';
import { execSync } from 'node:child_process';
import micromatch from 'micromatch';
const mockGlobSync = vi.mocked(globSync);
const mockExecSync = vi.mocked(execSync);
const mockMicromatch = vi.mocked(micromatch);
const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

// Import functions to test
import {
  hasChinese,
  toSafeTemplateLiteral,
  splitString,
  generateVarName,
  writeFileByCode,
  existFile,
  resolvePath,
  getCodeByPath,
  findEntryFilesPath,
  getStagedFiles,
  toUnixPath
} from '../src/utils';

describe('Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 测试中文字符检测
   */
  it('should detect Chinese characters', () => {
    expect(hasChinese('你好')).toBe(true);
    expect(hasChinese('Hello World')).toBe(false);
  });

  /**
   * 测试模板字符串安全转义功能
   */
  it('should escape template literal safely', () => {
    expect(toSafeTemplateLiteral('Hello `world`')).toBe('`Hello \\`world\\``');
    expect(toSafeTemplateLiteral('Hello ${name}')).toBe('`Hello \\${name}`');
  });

  /**
   * 测试字符串分割功能
   */
  it('should split string by length', () => {
    const result = splitString('  Hello world  ');
    expect(result).toEqual({
      leading: '  ',
      content: 'Hello world',
      trailing: '  '
    });
  });

  /**
   * 测试变量名生成
   */
  it('should generate variable names', () => {
    expect(generateVarName(0)).toBe('a');
    expect(generateVarName(25)).toBe('z');
    expect(generateVarName(26)).toBe('aa');
  });

  /**
   * 测试文件写入功能
   */
  it('should write file content', () => {
    mockFs.writeFileSync.mockReturnValue(undefined);
    
    writeFileByCode('/path/to/file.txt', 'content');
    
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/path/to/file.txt', 'content', 'utf-8');
  });

  /**
   * 测试文件读取功能
   */
  it('should read file content', () => {
    mockFs.readFileSync.mockReturnValue('file content');
    
    const content = getCodeByPath('/path/to/file.txt');
    
    expect(content).toBe('file content');
    expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
  });

  /**
   * 测试文件存在性检查
   */
  it('should check file existence', () => {
    mockFs.existsSync.mockReturnValue(true);
    
    const exists = existFile('/path/to/file.txt');
    
    expect(exists).toBe(true);
    expect(mockFs.existsSync).toHaveBeenCalledWith('/path/to/file.txt');
  });

  /**
   * 测试路径解析功能
   */
  it('should resolve path', () => {
    mockPath.resolve.mockReturnValue('/absolute/path');
    
    const resolved = resolvePath('./relative/path');
    
    expect(resolved).toBe('/absolute/path');
    expect(mockPath.resolve).toHaveBeenCalledWith(expect.any(String), './relative/path');
  });

  /**
   * 测试入口文件查找功能
   */
  it('should find files using include/exclude patterns', () => {
    const expectedFiles = ['src/file1.ts', 'src/file2.ts'];
    mockGlobSync.mockReturnValue(expectedFiles);
    
    const config = {
      include: ['src/**/*.ts'],
      exclude: ['**/test/**'],
      staged: false
    };
    
    const result = findEntryFilesPath(config);
    
    expect(result).toEqual(expectedFiles);
    expect(mockGlobSync).toHaveBeenCalledWith('src/**/*.ts', {
      absolute: true,
      ignore: ['**/test/**'],
      nodir: true
    });
  });

  it('should handle staged files with include/exclude patterns', () => {
    mockExecSync.mockReturnValue('src/file1.ts\nsrc/file2.js\ntest/file3.ts\n');
    mockPath.resolve.mockImplementation((cwd, path) => `/resolved/${path}`);
    mockPath.relative.mockImplementation((from, to) => to.replace('/resolved/', ''));
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockMicromatch.mockReturnValue(['src/file1.ts']);
    
    const config = {
      include: ['src/**/*.ts'],
      exclude: ['**/test/**'],
      staged: true
    };
    
    const result = findEntryFilesPath(config);
    
    expect(Array.isArray(result)).toBe(true);
    expect(mockExecSync).toHaveBeenCalled();
  });

  /**
   * 测试暂存文件获取功能
   */
  it('should get staged files', () => {
    mockExecSync.mockReturnValue('src/file1.js\nsrc/file2.ts\n');
    mockPath.resolve.mockImplementation((cwd, path) => `/resolved/${path}`);
    mockPath.relative.mockImplementation((from, to) => to.replace(from + '/', ''));
    mockMicromatch.mockReturnValue([]);
    mockPath.join.mockImplementation((...args) => args.join('/'));
    
    const files = getStagedFiles();
    
    expect(Array.isArray(files)).toBe(true);
    expect(mockExecSync).toHaveBeenCalled();
  });

  /**
   * 测试Unix路径转换
   */
  it('should convert to unix path', () => {
    expect(toUnixPath('C:\\path\\to\\file')).toBe('C:/path/to/file');
    expect(toUnixPath('/unix/path')).toBe('/unix/path');
  });
});