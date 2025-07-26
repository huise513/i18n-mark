export enum LogMode {
    NONE = 'none',
    FILE = 'file',
    CODE = 'code'
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

    private formatMessage(message: string, color?: string): string {
        const coloredMessage = color ? colorize(message, color) : message;
        return `${this.prefix} ${coloredMessage}`;
    }

    info(message: string): void {
        if (this.mode !== LogMode.NONE) {
            console.log(this.formatMessage(message, colors.blue));
        }
    }

    error(message: string): void {
        console.error(this.formatMessage(message, colors.red));
    }

    warn(message: string): void {
        if (this.mode !== LogMode.NONE) {
            console.warn(this.formatMessage(message, colors.yellow));
        }
    }

    success(message: string): void {
        if (this.mode !== LogMode.NONE) {
            console.log(this.formatMessage(message, colors.green));
        }
    }

    fileNormal(label: string, filename: string): void {
        if (this.mode === LogMode.FILE || this.mode === LogMode.CODE) {
            console.log(this.formatMessage(`${label}: ${colorize(filename, colors.magenta)}`));
        }
    }


    fileStart(filename: string): void {
        if (this.mode === LogMode.FILE || this.mode === LogMode.CODE) {
            console.log(this.formatMessage(`Processing: ${colorize(filename, colors.magenta)}`));
        }
    }

    fileProcessed(filename: string): void {
        if (this.mode === LogMode.FILE || this.mode === LogMode.CODE) {
            console.log(this.formatMessage(`Processed: ${colorize(filename, colors.magenta)}`));
        }
    }

    codeMatch(matchedText: string): void {
        if (this.mode === LogMode.CODE) {
            console.log(this.formatMessage(`Found: ${colorize(`${matchedText}`, colors.darkBlue)}`));
        }
    }

     codeNormal(label:string, matchedText: string): void {
        if (this.mode === LogMode.CODE) {
            console.log(this.formatMessage(`${label}: ${colorize(`${matchedText}`, colors.reset)}`));
        }
    }
}

export const logger = new Logger();