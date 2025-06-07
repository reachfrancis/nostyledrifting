import chalk from 'chalk';

/**
 * Progress bar interface
 */
export interface ProgressBar {
  start(total: number, startValue?: number): void;
  update(current: number, payload?: any): void;
  increment(payload?: any): void;
  stop(): void;
  setTotal(total: number): void;
}

/**
 * Progress event types
 */
export type ProgressEvent = 
  | 'start'
  | 'progress' 
  | 'complete'
  | 'error'
  | 'warning'
  | 'info';

/**
 * Progress payload interface
 */
export interface ProgressPayload {
  message?: string;
  details?: string;
  fileName?: string;
  percentage?: number;
  eta?: string;
  rate?: string;
  [key: string]: any;
}

/**
 * Simple terminal progress bar implementation
 */
class SimpleProgressBar implements ProgressBar {
  private total: number = 0;
  private current: number = 0;
  private startTime: number = 0;
  private lastUpdate: number = 0;
  private width: number = 40;

  start(total: number, startValue: number = 0): void {
    this.total = total;
    this.current = startValue;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.render();
  }

  update(current: number, payload?: ProgressPayload): void {
    this.current = current;
    this.render(payload);
  }

  increment(payload?: ProgressPayload): void {
    this.current++;
    this.render(payload);
  }

  stop(): void {
    this.render();
    process.stdout.write('\n');
  }

  setTotal(total: number): void {
    this.total = total;
  }

  private render(payload?: ProgressPayload): void {
    const now = Date.now();
    
    // Only update every 100ms to avoid flickering
    if (now - this.lastUpdate < 100 && this.current < this.total) {
      return;
    }
    this.lastUpdate = now;

    const percentage = this.total > 0 ? (this.current / this.total) : 0;
    const filled = Math.round(this.width * percentage);
    const empty = this.width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = (percentage * 100).toFixed(1);
    
    // Calculate ETA
    const elapsed = now - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta = this.current > 0 && rate > 0 ? 
      Math.round((this.total - this.current) / rate) : 0;
    
    const etaStr = eta > 0 ? this.formatTime(eta) : '--:--';
    const rateStr = rate > 0 ? `${rate.toFixed(1)}/s` : '--/s';
    
    let line = `\r${chalk.cyan('Progress:')} ${bar} ${percent}% (${this.current}/${this.total}) `;
    line += `${chalk.gray(`ETA: ${etaStr} | Rate: ${rateStr}`)}`;
    
    if (payload?.message) {
      line += ` ${chalk.yellow(payload.message)}`;
    }
    
    process.stdout.write(line);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Progress Handler for CLI operations
 */
export class ProgressHandler {
  private progressBar: ProgressBar;
  private verbose: boolean;
  private silent: boolean;

  constructor(verbose: boolean = false, silent: boolean = false) {
    this.verbose = verbose;
    this.silent = silent;
    this.progressBar = new SimpleProgressBar();
  }

  /**
   * Start progress tracking
   */
  startProgress(total: number, message?: string): void {
    if (this.silent) return;
    
    if (message) {
      this.info(message);
    }
    this.progressBar.start(total);
  }

  /**
   * Update progress
   */
  updateProgress(current: number, payload?: ProgressPayload): void {
    if (this.silent) return;
    
    this.progressBar.update(current, payload);
  }

  /**
   * Increment progress
   */
  incrementProgress(payload?: ProgressPayload): void {
    if (this.silent) return;
    
    this.progressBar.increment(payload);
  }

  /**
   * Stop progress tracking
   */
  stopProgress(): void {
    if (this.silent) return;
    
    this.progressBar.stop();
  }

  /**
   * Set total for progress tracking
   */
  setTotal(total: number): void {
    this.progressBar.setTotal(total);
  }

  /**
   * Log info message
   */
  info(message: string, details?: string): void {
    if (this.silent) return;
    
    console.log(chalk.blue('ℹ'), message);
    if (details && this.verbose) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Log success message
   */
  success(message: string, details?: string): void {
    if (this.silent) return;
    
    console.log(chalk.green('✓'), message);
    if (details && this.verbose) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Log warning message
   */
  warning(message: string, details?: string): void {
    if (this.silent) return;
    
    console.log(chalk.yellow('⚠'), message);
    if (details && this.verbose) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Log error message
   */
  error(message: string, details?: string): void {
    if (this.silent) return;
    
    console.error(chalk.red('✗'), message);
    if (details && this.verbose) {
      console.error(chalk.gray(`  ${details}`));
    }
  }
  /**
   * Log verbose message (only shown in verbose mode)
   */
  logVerbose(message: string, details?: string): void {
    if (this.silent || !this.verbose) return;
    
    console.log(chalk.gray('→'), chalk.gray(message));
    if (details) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Create a spinner for long-running operations
   */
  createSpinner(message: string): Spinner {
    return new Spinner(message, this.silent);
  }

  /**
   * Log a separator line
   */
  separator(): void {
    if (this.silent) return;
    
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    if (this.silent) return;
    
    console.log();
    console.log(chalk.bold.blue(title));
    console.log(chalk.gray('─'.repeat(title.length)));
  }

  /**
   * Create a table formatter
   */
  createTable(): TableFormatter {
    return new TableFormatter(this.silent);
  }

  /**
   * Log performance metrics
   */
  metrics(metrics: Record<string, any>): void {
    if (this.silent || !this.verbose) return;
    
    console.log();
    console.log(chalk.bold.cyan('Performance Metrics:'));
    Object.entries(metrics).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}:`), chalk.white(value));
    });
  }
}

/**
 * Simple spinner implementation
 */
class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private index = 0;
  private message: string;
  private silent: boolean;

  constructor(message: string, silent: boolean = false) {
    this.message = message;
    this.silent = silent;
  }

  start(): void {
    if (this.silent) return;
    
    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(this.frames[this.index])} ${this.message}`);
      this.index = (this.index + 1) % this.frames.length;
    }, 80);
  }

  stop(finalMessage?: string): void {
    if (this.silent) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write(`\r${chalk.green('✓')} ${finalMessage || this.message}\n`);
  }

  fail(errorMessage?: string): void {
    if (this.silent) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write(`\r${chalk.red('✗')} ${errorMessage || this.message}\n`);
  }
}

/**
 * Simple table formatter
 */
class TableFormatter {
  private headers: string[] = [];
  private rows: string[][] = [];
  private silent: boolean;

  constructor(silent: boolean = false) {
    this.silent = silent;
  }

  setHeaders(headers: string[]): void {
    this.headers = headers;
  }

  addRow(row: string[]): void {
    this.rows.push(row);
  }

  render(): void {
    if (this.silent || this.headers.length === 0) return;

    // Calculate column widths
    const widths = this.headers.map((header, i) => {
      const maxRowWidth = Math.max(...this.rows.map(row => (row[i] || '').length));
      return Math.max(header.length, maxRowWidth);
    });

    // Render headers
    const headerRow = this.headers.map((header, i) => 
      header.padEnd(widths[i])
    ).join(' │ ');
    console.log(chalk.bold(headerRow));
    
    // Render separator
    const separator = widths.map(width => '─'.repeat(width)).join('─┼─');
    console.log(chalk.gray(separator));

    // Render rows
    this.rows.forEach(row => {
      const rowStr = row.map((cell, i) => 
        (cell || '').padEnd(widths[i])
      ).join(' │ ');
      console.log(rowStr);
    });
  }
}

/**
 * Create a progress handler instance
 */
export function createProgressHandler(verbose: boolean = false, silent: boolean = false): ProgressHandler {
  return new ProgressHandler(verbose, silent);
}
