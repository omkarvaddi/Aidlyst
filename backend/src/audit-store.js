const fs = require('fs');
const path = require('path');

class FileAuditStore {
  constructor(directory) {
    this.directory = directory;
  }

  ensureDirectory() {
    fs.mkdirSync(this.directory, { recursive: true });
  }

  save(record) {
    if (!record || typeof record !== 'object' || !record.id) {
      throw new TypeError('Audit record must include an id.');
    }

    this.ensureDirectory();
    const filePath = this.auditPath(record.id);
    const json = `${JSON.stringify(record, null, 2)}\n`;
    fs.writeFileSync(filePath, json, 'utf8');
    fs.appendFileSync(path.join(this.directory, 'audit-log.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
    return filePath;
  }

  get(id) {
    const filePath = this.auditPath(id);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  auditPath(id) {
    const safeId = String(id || '');
    if (!/^[a-zA-Z0-9_-]+$/.test(safeId)) {
      throw new Error('Invalid audit id.');
    }
    return path.join(this.directory, `${safeId}.json`);
  }
}

module.exports = {
  FileAuditStore
};
