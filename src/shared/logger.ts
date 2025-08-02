export enum LogMode {
    NONE = 'none',
    FILE = 'file',
    LINE = 'line'
}

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    darkBlue: '\x1b[38;5;69m',
    gray: '\x1b[39m'
};

function colorize(text: string, color: string): string {
    return `${color}${text}${colors.reset}`;
}

class Logger {
    private mode: LogMode = LogMode.NONE;
    private readonly prefix = colorize('[i18n-mark]', colors.cyan);

    configure(mode: LogMode) {
        this.mode = mode;
    }

    /**
     * 格式化消息，支持多个参数
     * @param args - 要格式化的参数列表
     * @param color - 可选的颜色
     * @returns 格式化后的消息字符串
     */
    private formatMessage(args: string | any[], color?: string): string {
        if (typeof args === 'string') {
            args = [args];
        }
        const message = args.map(arg => 
            typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');
        const coloredMessage = color ? colorize(message, color) : message;
        return `${this.prefix} ${coloredMessage}`;
    }

    /**
     * 输出信息日志，支持多个参数
     * @param args - 要输出的参数列表
     */
    info(...args: any[]): void {
        console.log(this.formatMessage(args, colors.blue));
    }

    /**
     * 输出调试日志，支持多个参数
     * @param args - 要输出的参数列表
     */
    debug(...args: any[]): void {
        console.debug(this.formatMessage(args, colors.blue));
    }

    /**
     * 输出错误日志，支持多个参数
     * @param args - 要输出的参数列表
     */
    error(...args: any[]): void {
        console.error(this.formatMessage(args, colors.red));
    }

    /**
     * 输出警告日志，支持多个参数
     * @param args - 要输出的参数列表
     */
    warn(...args: any[]): void {
        console.warn(this.formatMessage(args, colors.yellow));
    }

    /**
     * 输出成功日志，支持多个参数
     * @param args - 要输出的参数列表
     */
    success(...args: any[]): void {
        console.log(this.formatMessage(args, colors.green));
    }

    file(message: string): void {
        if (this.mode === LogMode.FILE || this.mode === LogMode.LINE) {
            console.log(this.formatMessage(`${colorize(message, colors.magenta)}`));
        }
    }

    line(matchedText: string): void {
        if (this.mode === LogMode.LINE) {
            console.log(this.formatMessage(`${colorize(matchedText, colors.darkBlue)}`));
        }
    }
}

export const logger = new Logger();