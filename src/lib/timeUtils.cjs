"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayDateStr = getTodayDateStr;
exports.getTomorrowDateStr = getTomorrowDateStr;
exports.getExpectedTimestamp = getExpectedTimestamp;
exports.formatTo12Hour = formatTo12Hour;
exports.getCurrentTime12Hour = getCurrentTime12Hour;
exports.getDeliveryTimeInfo = getDeliveryTimeInfo;
exports.getCountdownInfo = getCountdownInfo;
exports.sortOrdersByDeliveryPriority = sortOrdersByDeliveryPriority;
/**
 * Returns local YYYY-MM-DD string according to device/client timezone (e.g. IST)
 */
function getTodayDateStr(date) {
    if (date === void 0) { date = new Date(); }
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return "".concat(y, "-").concat(m, "-").concat(d);
}
/**
 * Returns tomorrow's local YYYY-MM-DD string
 */
function getTomorrowDateStr(date) {
    if (date === void 0) { date = new Date(); }
    var next = new Date(date);
    next.setDate(next.getDate() + 1);
    return getTodayDateStr(next);
}
/**
 * Parses time string like "14:30" or "2:30 PM" or "14:30:00" on a given date string "YYYY-MM-DD"
 */
function parseDateTime(dateStr, timeStr) {
    if (!dateStr)
        return null;
    var cleanDate = dateStr.trim();
    if (cleanDate.includes('T')) {
        cleanDate = cleanDate.split('T')[0];
    }
    var year = 0;
    var month = 0;
    var day = 0;
    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    var dmy = cleanDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmy) {
        day = parseInt(dmy[1], 10);
        month = parseInt(dmy[2], 10) - 1;
        var yr = dmy[3];
        if (yr.length === 2)
            yr = "20".concat(yr);
        year = parseInt(yr, 10);
    }
    else {
        // Match YYYY-MM-DD or YYYY/MM/DD
        var ymd = cleanDate.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
        if (ymd) {
            year = parseInt(ymd[1], 10);
            month = parseInt(ymd[2], 10) - 1;
            day = parseInt(ymd[3], 10);
        }
    }
    if (!year || isNaN(year)) {
        var rawParsed = new Date(cleanDate).getTime();
        if (!isNaN(rawParsed) && rawParsed > 0) {
            var dt = new Date(rawParsed);
            year = dt.getFullYear();
            month = dt.getMonth();
            day = dt.getDate();
        }
        else {
            return null;
        }
    }
    var hours = 18;
    var minutes = 0;
    if (timeStr) {
        var cleanTime = timeStr.trim().toUpperCase();
        cleanTime = cleanTime.replace(/(\d+)\.(\d+)/, '$1:$2');
        var isPM = cleanTime.includes('PM');
        var isAM = cleanTime.includes('AM');
        var digits = cleanTime.replace(/[^0-9:]/g, '').split(':');
        if (digits.length >= 1 && digits[0]) {
            hours = parseInt(digits[0], 10) || 0;
        }
        if (digits.length >= 2 && digits[1]) {
            minutes = parseInt(digits[1], 10) || 0;
        }
        if (isPM && hours < 12)
            hours += 12;
        if (isAM && hours === 12)
            hours = 0;
        hours = Math.min(23, Math.max(0, hours));
        minutes = Math.min(59, Math.max(0, minutes));
    }
    var result = new Date(year, month, day, hours, minutes, 0);
    return isNaN(result.getTime()) ? null : result;
}
/**
 * Gets expected timestamp for an order in milliseconds
 */
function getExpectedTimestamp(order) {
    var dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];
    var expectedTimeStr = order.delivery_time_expected || order.order_time || '18:00';
    var expectedDate = parseDateTime(dateStr, expectedTimeStr);
    return expectedDate ? expectedDate.getTime() : 0;
}
/**
 * Formats any time or date-time string into standard 12-Hour format (e.g., "06:30 PM")
 */
function formatTo12Hour(timeStr) {
    if (!timeStr)
        return '';
    var str = timeStr.trim();
    if (!str)
        return '';
    // If already contains AM or PM (case insensitive), normalize format
    if (/am|pm/i.test(str)) {
        var match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
        if (match) {
            var h = parseInt(match[1], 10);
            var m = match[2];
            var ampm = match[3].toUpperCase();
            var hStr = h < 10 ? "0".concat(h) : "".concat(h);
            return "".concat(hStr, ":").concat(m, " ").concat(ampm);
        }
        return str.toUpperCase();
    }
    // Check if it's an ISO or full Date string
    if (str.includes('T') || str.includes('Z')) {
        var d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
    }
    // Match 24-hour HH:MM or HH:MM:SS format (e.g., "18:30" or "09:15:00")
    var match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
        var hours = parseInt(match24[1], 10);
        var minutes = match24[2];
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0)
            hours = 12;
        var hStr = hours < 10 ? "0".concat(hours) : "".concat(hours);
        return "".concat(hStr, ":").concat(minutes, " ").concat(ampm);
    }
    return str;
}
/**
 * Returns current system time formatted in 12-hour AM/PM format (e.g., "10:30 AM")
 */
function getCurrentTime12Hour() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
/**
 * Calculates Expected Delivery Time, Actual Delivery Time, and Delay in Minutes
 */
function getDeliveryTimeInfo(order) {
    var dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];
    var expectedTimeStr = order.delivery_time_expected || order.order_time || '06:00 PM';
    var expectedDate = parseDateTime(dateStr, expectedTimeStr);
    // Format Expected Time in 12-Hour AM/PM
    var expectedFormatted = formatTo12Hour(expectedTimeStr);
    if (expectedDate) {
        expectedFormatted = expectedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    // Actual Delivery Time
    var actualDate = null;
    var actualFormatted = 'Pending Delivery';
    if (order.actual_delivery_time) {
        var d = new Date(order.actual_delivery_time);
        if (!isNaN(d.getTime())) {
            actualDate = d;
            actualFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        else {
            actualFormatted = formatTo12Hour(order.actual_delivery_time);
        }
    }
    else if (order.status === 'delivered') {
        actualFormatted = 'Delivered';
    }
    // Calculate Delay
    var delayMinutes = 0;
    var isOverdue = false;
    if (expectedDate) {
        if (order.status === 'delivered' && actualDate) {
            // Delivered order: difference between actual delivery timestamp and expected timestamp
            var diffMs = actualDate.getTime() - expectedDate.getTime();
            delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
            isOverdue = delayMinutes > 0;
        }
        else if (order.status !== 'delivered' && order.status !== 'cancelled') {
            // Pending / Active order: difference between NOW and expected timestamp if NOW > expected
            var now = new Date();
            if (now > expectedDate) {
                var diffMs = now.getTime() - expectedDate.getTime();
                delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
                isOverdue = delayMinutes > 0;
            }
        }
    }
    var delayText = 'On Time (0 min)';
    if (delayMinutes > 0) {
        delayText = "".concat(delayMinutes, " min Delay");
    }
    return {
        expectedFormatted: expectedFormatted,
        actualFormatted: actualFormatted,
        delayMinutes: delayMinutes,
        delayText: delayText,
        isOverdue: isOverdue
    };
}
/**
 * Calculates live Countdown Timer info for an order
 */
function getCountdownInfo(order, nowTime) {
    if (nowTime === void 0) { nowTime = Date.now(); }
    if (order.status === 'delivered') {
        return {
            text: 'Delivered',
            minutesRemaining: 99999,
            urgency: 'completed',
            badgeColorClass: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
        };
    }
    if (order.status === 'cancelled') {
        return {
            text: 'Cancelled',
            minutesRemaining: 99999,
            urgency: 'completed',
            badgeColorClass: 'bg-slate-900 text-slate-400 border border-slate-800'
        };
    }
    var dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];
    var expectedTimeStr = order.delivery_time_expected || order.order_time || '18:00';
    var expectedDate = parseDateTime(dateStr, expectedTimeStr);
    if (!expectedDate) {
        return {
            text: 'No Time Set',
            minutesRemaining: 99999,
            urgency: 'normal',
            badgeColorClass: 'bg-slate-900 text-slate-300 border border-slate-800'
        };
    }
    var diffMs = expectedDate.getTime() - nowTime;
    var diffMinutes = Math.round(diffMs / (1000 * 60));
    if (diffMinutes < 0) {
        var overdueMins = Math.abs(diffMinutes);
        var hrs_1 = Math.floor(overdueMins / 60);
        var mins_1 = overdueMins % 60;
        var timeStr_1 = hrs_1 > 0 ? "".concat(hrs_1, "h ").concat(mins_1, "m") : "".concat(mins_1, "m");
        return {
            text: "\u26A0\uFE0F OVERDUE by ".concat(timeStr_1),
            minutesRemaining: diffMinutes,
            urgency: 'overdue',
            badgeColorClass: 'bg-rose-600 text-white font-black animate-pulse shadow-lg shadow-rose-950/80 border border-rose-400'
        };
    }
    if (diffMinutes <= 30) {
        return {
            text: "\u23F0 ".concat(diffMinutes, " MIN LEFT"),
            minutesRemaining: diffMinutes,
            urgency: 'critical',
            badgeColorClass: 'bg-amber-500 text-slate-950 font-black animate-bounce border border-amber-300 shadow-md shadow-amber-950/80'
        };
    }
    if (diffMinutes <= 90) {
        var hrs_2 = Math.floor(diffMinutes / 60);
        var mins_2 = diffMinutes % 60;
        var timeStr_2 = hrs_2 > 0 ? "".concat(hrs_2, "h ").concat(mins_2, "m") : "".concat(mins_2, "m");
        return {
            text: "\u23F3 ".concat(timeStr_2, " left"),
            minutesRemaining: diffMinutes,
            urgency: 'warning',
            badgeColorClass: 'bg-amber-950/90 text-amber-300 font-extrabold border border-amber-800/70'
        };
    }
    var hrs = Math.floor(diffMinutes / 60);
    var mins = diffMinutes % 60;
    var timeStr = hrs > 0 ? "".concat(hrs, "h ").concat(mins, "m") : "".concat(mins, "m");
    return {
        text: "\u23F1\uFE0F ".concat(timeStr, " left"),
        minutesRemaining: diffMinutes,
        urgency: 'normal',
        badgeColorClass: 'bg-indigo-950/80 text-indigo-300 font-bold border border-indigo-800/60'
    };
}
/**
 * Sorts orders so that earliest due active orders appear first!
 */
function sortOrdersByDeliveryPriority(orders) {
    return __spreadArray([], orders, true).sort(function (a, b) {
        // Delivered / Cancelled / Rider Delivered / Confirmation Pending go to the bottom
        var aDone = a.status === 'delivered' || a.status === 'cancelled' || Boolean(a.rider_delivered) || Boolean(a.delivery_confirmation_pending);
        var bDone = b.status === 'delivered' || b.status === 'cancelled' || Boolean(b.rider_delivered) || Boolean(b.delivery_confirmation_pending);
        if (aDone && !bDone)
            return 1;
        if (!aDone && bDone)
            return -1;
        // Active orders sorted by expected time timestamp (earliest first)
        var timeA = getExpectedTimestamp(a);
        var timeB = getExpectedTimestamp(b);
        return timeA - timeB;
    });
}
