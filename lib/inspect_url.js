const utils = require('./utils');
const crypto = require('crypto');

let hasEmbeddedInspectSupport = false;
try {
    require.resolve('globaloffensive/lib/inspect-link.js');
    hasEmbeddedInspectSupport = true;
} catch (e) {
    hasEmbeddedInspectSupport = false;
}

class InspectURL {
    constructor() {
        this.requiredParams = ['s', 'a', 'd', 'm'];

        if (arguments.length === 1 && typeof arguments[0] === 'string') {
            // parse the inspect link
            this.parseLink(arguments[0]);
        }
        else if (arguments.length === 1 && typeof arguments[0] === 'object') {
            // parse object with the requiredParams

            for (let param of this.requiredParams) {
                if (arguments[0][param] && typeof arguments[0][param] === 'string' && arguments[0][param].length > 0) {
                    this[param] = arguments[0][param];
                }
                else this[param] = '0';
            }
        }
        else if (arguments.length === 4) {
            // parse each arg

            // Ensure each arg is a string
            for (let param in this.requiredParams) {
                if (typeof arguments[param] === 'string') {
                    this[this.requiredParams[param]] = arguments[param];
                }
                else return;
            }
        }
    }

    get valid() {
        // Ensure each param exists and only contains digits
        for (let param of this.requiredParams) {
            if (!this[param] || !utils.isOnlyDigits(this[param])) return false;
        }

        return true;
    }

    parseLink(link) {
        this.originalLink = link;

        try {
            link = decodeURI(link);
        } catch (e) {
            // Keep using the raw link if URI decoding fails (e.g. unresolved %propid placeholders)
        }

        // Legacy inspect links (supports both run and rungame forms)
        let groups = /^steam:\/\/(?:run|rungame)\/730\/(?:\d+)?\/[+ ]csgo_econ_action_preview\s+([SM])(\d+)A(\d+)D(\d+)$/i.exec(link);

        if (groups) {
            if (groups[1].toUpperCase() === 'S') {
                this.s = groups[2];
                this.m = '0';
            }
            else if (groups[1].toUpperCase() === 'M') {
                this.m = groups[2];
                this.s = '0';
            }

            this.a = groups[3];
            this.d = groups[4];
            this.lookupLink = link;
            return;
        }

        // New embedded inspect payload format (e.g. Item Certificate value)
        groups = /^steam:\/\/(?:run|rungame)\/730\/(?:\d+)?\/[+ ]csgo_econ_action_preview\s+([0-9A-F]{40,})$/i.exec(link);
        if (groups) {
            if (!hasEmbeddedInspectSupport) {
                // Embedded inspect tokens require globaloffensive support (v3.3.0+).
                return;
            }

            this.s = '0';
            this.m = '0';
            this.d = '0';

            // Use a deterministic temporary ID so internal bookkeeping remains stable
            // until the true item ID is received from Steam GC.
            this.a = InspectURL.getTemporaryAssetId(groups[1]);
            this.hasEmbeddedData = true;
            this.lookupLink = link;
        }
    }

    static getTemporaryAssetId(data) {
        const hex = crypto.createHash('sha1').update(data).digest('hex').slice(0, 15);
        return BigInt(`0x${hex}`).toString();
    }

    setResolvedAssetId(assetId) {
        if (typeof assetId === 'string' && utils.isOnlyDigits(assetId) && assetId.length > 0) {
            this.a = assetId;
        }
    }

    getParams() {
        if (this.valid) return {s: this.s, a: this.a, d: this.d, m: this.m};
    }

    isMarketLink() {
        return this.valid && this.m !== '0';
    }

    getLink() {
        if (this.lookupLink) {
            return this.lookupLink;
        }

        if (!this.valid) return;

        if (this.s === '0' && this.m) {
            return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview M${this.m}A${this.a}D${this.d}`;
        }
        else {
            return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview S${this.s}A${this.a}D${this.d}`;
        }
    }
}

module.exports = InspectURL;
