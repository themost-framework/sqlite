// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP

import { sprintf } from 'sprintf-js';
import { SqlFormatter } from '@themost/query';

const REGEXP_SINGLE_QUOTE=/\\'/g;
const SINGLE_QUOTE_ESCAPE ='\'\'';
const REGEXP_DOUBLE_QUOTE=/\\"/g;
const DOUBLE_QUOTE_ESCAPE = '"';
const REGEXP_SLASH=/\\\\/g;
const SLASH_ESCAPE = '\\';


function zeroPad(number, length) {
    number = number || 0;
    let res = number.toString();
    while (res.length < length) {
        res = '0' + res;
    }
    return res;
}

class SqliteFormatter extends SqlFormatter {

    static get NAME_FORMAT() {
        return '`$1`';
    }

    /**
     * @constructor
     */
    constructor() {
        super();
        this.settings = {
            nameFormat: SqliteFormatter.NAME_FORMAT,
            forceAlias: true
        };
    }
    /**
     * Escapes an object or a value and returns the equivalent sql value.
     * @param {*} value - A value that is going to be escaped for SQL statements
     * @param {boolean=} unquoted - An optional value that indicates whether the resulted string will be quoted or not.
     * returns {string} - The equivalent SQL string value
     */
    escape(value, unquoted) {
        if (typeof value === 'boolean') {
            return value ? '1' : '0';
        }
        if (value instanceof Date) {
            return this.escapeDate(value);
        }
        let res = super.escape.bind(this)(value, unquoted);
        if (typeof value === 'string') {
            if (REGEXP_SINGLE_QUOTE.test(res))
                //escape single quote (that is already escaped)
                res = res.replace(/\\'/g, SINGLE_QUOTE_ESCAPE);
            if (REGEXP_DOUBLE_QUOTE.test(res))
                //escape double quote (that is already escaped)
                res = res.replace(/\\"/g, DOUBLE_QUOTE_ESCAPE);
            if (REGEXP_SLASH.test(res))
                //escape slash (that is already escaped)
                res = res.replace(/\\\\/g, SLASH_ESCAPE);
        }
        return res;
    }
    /**
     * @param {Date|*} val
     * @returns {string}
     */
    escapeDate(val) {
        const year = val.getFullYear();
        const month = zeroPad(val.getMonth() + 1, 2);
        const day = zeroPad(val.getDate(), 2);
        const hour = zeroPad(val.getHours(), 2);
        const minute = zeroPad(val.getMinutes(), 2);
        const second = zeroPad(val.getSeconds(), 2);
        const millisecond = zeroPad(val.getMilliseconds(), 3);
        //format timezone
        const offset = val.getTimezoneOffset(), timezone = (offset <= 0 ? '+' : '-') + zeroPad(-Math.floor(offset / 60), 2) + ':' + zeroPad(offset % 60, 2);
        return '\'' + year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + '.' + millisecond + timezone + '\'';
    }
    /**
     * Implements indexOf(str,substr) expression formatter.
     * @param {string} p0 The source string
     * @param {string} p1 The string to search for
     * @returns {string}
     */
    $indexof(p0, p1) {
        return sprintf('(INSTR(%s,%s)-1)', this.escape(p0), this.escape(p1));
    }
    /**
     * Implements indexOf(str,substr) expression formatter.
     * @param {string} p0 The source string
     * @param {string} p1 The string to search for
     * @returns {string}
     */
    $indexOf(p0, p1) {
        return sprintf('(INSTR(%s,%s)-1)', this.escape(p0), this.escape(p1));
    }
    /**
     * Implements contains(a,b) expression formatter.
     * @param {*} p0 The source string
     * @param {*} p1 The string to search for
     * @returns {string}
     */
    $text(p0, p1) {
        return sprintf('(INSTR(%s,%s)-1)>=0', this.escape(p0), this.escape(p1));
    }
    /**
     * Implements simple regular expression formatter. Important Note: SQLite 3 does not provide a core sql function for regular expression matching.
     * @param {*} p0 The source string or field
     * @param {*} p1 The string to search for
     */
    $regex(p0, p1) {
        //escape expression
        let s1 = this.escape(p1, true);
        //implement starts with equivalent for LIKE T-SQL
        if (/^\^/.test(s1)) {
            s1 = s1.replace(/^\^/, '');
        }
        else {
            s1 = '%' + s1;
        }
        //implement ends with equivalent for LIKE T-SQL
        if (/\$$/.test(s1)) {
            s1 = s1.replace(/\$$/, '');
        }
        else {
            s1 += '%';
        }
        return sprintf('LIKE(\'%s\',%s) >= 1', s1, this.escape(p0));
    }
    /**
     * Implements concat(a,b) expression formatter.
     * @param {*} p0
     * @param {*} p1
     * @returns {string}
     */
    // eslint-disable-next-line no-unused-vars
    $concat(p0, p1) {
        const args = Array.from(arguments);
        if (args.length < 2) {
            throw new Error('Concat method expects two or more arguments');
        }
        let result = '(';
        result += Array.from(args).map((arg) => {
            return `IFNULL(${this.escape(arg)},\'\')`
        }).join(' || ');
        result += ')';
        return result;
    }
    /**
     * Implements substring(str,pos) expression formatter.
     * @param {String} p0 The source string
     * @param {Number} pos The starting position
     * @param {Number=} length The length of the resulted string
     * @returns {string}
     */
    $substring(p0, pos, length) {
        if (length) {
            return sprintf('SUBSTR(%s,%s + 1,%s)', this.escape(p0), this.escape(pos), this.escape(length));
        } else {
            return sprintf('SUBSTR(%s,%s + 1)', this.escape(p0), this.escape(pos));
        }
    }
    /**
     * Implements substring(str,pos) expression formatter.
     * @param {String} p0 The source string
     * @param {Number} pos The starting position
     * @param {Number=} length The length of the resulted string
     * @returns {string}
     */
    $substr(p0, pos, length) {
        if (length) {
            return sprintf('SUBSTR(%s,%s + 1,%s)', this.escape(p0), this.escape(pos), this.escape(length));
        } else {
            return sprintf('SUBSTR(%s,%s + 1)', this.escape(p0), this.escape(pos));
        }
    }
    /**
     * Implements length(a) expression formatter.
     * @param {*} p0
     * @returns {string}
     */
    $length(p0) {
        return sprintf('LENGTH(%s)', this.escape(p0));
    }
    $ceiling(p0) {
        return sprintf('CEIL(%s)', this.escape(p0));
    }
    $startswith(p0, p1) {
        //validate params
        if (p0 == null || p1 == null)
            return '';
        return 'LIKE(\'' + this.escape(p1, true) + '%\',' + this.escape(p0) + ')';
    }
    $contains(p0, p1) {
        //validate params
        if (p0 == null || p1 == null)
            return '';
        return 'LIKE(\'%' + this.escape(p1, true) + '%\',' + this.escape(p0) + ')';
    }
    $endswith(p0, p1) {
        //validate params
        if (p0 == null || p1 == null)
            return '';
        return 'LIKE(\'%' + this.escape(p1, true) + '\',' + this.escape(p0) + ')';
    }
    $day(p0) {
        return 'CAST(strftime(\'%d\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $dayOfMonth(p0) {
        return 'CAST(strftime(\'%d\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $month(p0) {
        return 'CAST(strftime(\'%m\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $year(p0) {
        return 'CAST(strftime(\'%Y\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $hour(p0) {
        return 'CAST(strftime(\'%H\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $hours(p0) {
        return this.$hour(p0);
    }
    $minute(p0) {
        return 'CAST(strftime(\'%M\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $minutes(p0) {
        return this.$minute(p0);
    }
    $second(p0) {
        return 'CAST(strftime(\'%S\', ' + this.escape(p0) + ') AS INTEGER)';
    }
    $seconds(p0) {
        return this.$second(p0);
    }
    $date(p0) {
        return 'date(' + this.escape(p0) + ')';
    }
    /**
     * @deprecated Use $ifNull() instead
     * @param {*} p0 
     * @param {*} p1 
     * @returns 
     */
    $ifnull(p0, p1) {
        return sprintf('IFNULL(%s, %s)', this.escape(p0), this.escape(p1));
    }
    $ifNull(p0, p1) {
        return sprintf('IFNULL(%s, %s)', this.escape(p0), this.escape(p1));
    }
    $toString(p0) {
        return sprintf('CAST(%s as TEXT)', this.escape(p0));
    }
}

export {
    SqliteFormatter
};