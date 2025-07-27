#!/usr/bin/env bun

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * 版本类型枚举
 */
type VersionType = 'patch' | 'minor' | 'major';

/**
 * 执行命令并输出结果
 * @param command 要执行的命令
 * @param options 执行选项
 */
function runCommand(command: string, options: { silent?: boolean } = {}) {
  console.log(`🔄 执行命令: ${command}`);
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit' 
    });
    return result;
  } catch (error) {
    console.error(`❌ 命令执行失败: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * 获取当前版本号
 * @returns 当前版本号
 */
function getCurrentVersion(): string {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

/**
 * 更新版本号
 * @param versionType 版本类型
 * @returns 新版本号
 */
function updateVersion(versionType: VersionType): string {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  
  const currentVersion = packageJson.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion: string;
  switch (versionType) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  packageJson.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, '\t') + '\n');
  
  console.log(`📦 版本号已更新: ${currentVersion} -> ${newVersion}`);
  return newVersion;
}

/**
 * 检查工作目录是否干净
 */
function checkWorkingDirectory() {
  try {
    const status = runCommand('git status --porcelain', { silent: true });
    if (status && status.trim()) {
      console.error('❌ 工作目录不干净，请先提交或暂存所有更改');
      console.error('未提交的更改:');
      console.error(status);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 无法检查 git 状态，请确保在 git 仓库中');
    process.exit(1);
  }
}


/**
 * 构建项目
 */
function releaseProject() {
  console.log('🔨 构建项目...');
  runCommand('pnpm release');
  console.log('✅ 构建完成');
}

/**
 * 提交更改并创建标签
 * @param version 版本号
 */
function commitAndTag(version: string) {
  console.log('📝 提交更改...');
  runCommand('git add .');
  runCommand(`git commit -m "chore: release v${version}"`);
  
  console.log('🏷️ 创建标签...');
  runCommand(`git tag -a v${version} -m "Release v${version}"`);
  
  console.log('✅ 提交和标签创建完成');
}

/**
 * 推送到远程仓库
 */
function pushToRemote() {
  console.log('🚀 推送到远程仓库...');
  runCommand('git push');
  runCommand('git push --tags');
  console.log('✅ 推送完成');
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] as VersionType;
  const skipPush = args.includes('--skip-push');
  
  if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
    console.error('❌ 请指定版本类型: patch, minor, 或 major');
    console.error('用法: bun scripts/release.ts <patch|minor|major> [--skip-push] [--skip-tests]');
    console.error('示例: bun scripts/release.ts patch');
    process.exit(1);
  }
  
  console.log('🚀 开始发布流程...');
  console.log(`📋 版本类型: ${versionType}`);
  
  // 检查工作目录
  checkWorkingDirectory();
  
  // 更新版本号
  const newVersion = updateVersion(versionType);
  

  // 发布
  releaseProject();
  
  // 提交更改并创建标签
  commitAndTag(newVersion);
  
  // 推送到远程仓库（除非跳过）
  if (!skipPush) {
    pushToRemote();
  } else {
    console.log('⚠️ 跳过推送到远程仓库');
    console.log('💡 手动推送命令:');
    console.log('   git push');
    console.log('   git push --tags');
  }
  
  console.log('🎉 发布完成!');
  console.log(`📦 新版本: v${newVersion}`);
  
}

// 运行主函数
main();