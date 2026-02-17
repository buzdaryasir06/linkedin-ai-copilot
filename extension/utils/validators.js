/**
 * utils/validators.js
 *
 * Input validation for job data, ensuring data integrity
 * and preventing injection attacks.
 */

class JobValidator {
  /**
   * Validate complete job object
   */
  static validateJob(job) {
    const errors = [];

    if (!job.job_id || typeof job.job_id !== 'string') {
      errors.push('job_id is required and must be a string');
    }

    if (!job.job_title || typeof job.job_title !== 'string' || job.job_title.length < 2) {
      errors.push('job_title is required and must be at least 2 characters');
    }

    if (!job.company_name || typeof job.company_name !== 'string' || job.company_name.length < 1) {
      errors.push('company_name is required');
    }

    if (job.location && typeof job.location !== 'string') {
      errors.push('location must be a string');
    }

    if (job.match_percentage !== undefined) {
      if (typeof job.match_percentage !== 'number' || job.match_percentage < 0 || job.match_percentage > 100) {
        errors.push('match_percentage must be a number between 0 and 100');
      }
    }

    if (job.status && !['new', 'saved', 'applied', 'rejected', 'archived'].includes(job.status)) {
      errors.push('status must be one of: new, saved, applied, rejected, archived');
    }

    if (job.ranking_level && !['high', 'medium', 'low'].includes(job.ranking_level)) {
      errors.push('ranking_level must be one of: high, medium, low');
    }

    if (job.missing_skills && !Array.isArray(job.missing_skills)) {
      errors.push('missing_skills must be an array');
    }

    if (job.matched_skills && !Array.isArray(job.matched_skills)) {
      errors.push('matched_skills must be an array');
    }

    if (job.salary_min !== undefined && job.salary_min !== null && typeof job.salary_min !== 'number') {
      errors.push('salary_min must be a number');
    }

    if (job.salary_max !== undefined && job.salary_max !== null && typeof job.salary_max !== 'number') {
      errors.push('salary_max must be a number');
    }

    // Cross-field validation
    if (job.salary_min !== undefined && job.salary_min !== null &&
        job.salary_max !== undefined && job.salary_max !== null &&
        job.salary_min > job.salary_max) {
      errors.push('salary_min must be less than or equal to salary_max');
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join('; '));
    }

    return job;
  }

  /**
   * Validate batch job array
   */
  static validateJobBatch(jobs) {
    if (!Array.isArray(jobs)) {
      throw new ValidationError('Jobs must be an array');
    }

    if (jobs.length === 0) {
      throw new ValidationError('Jobs array cannot be empty');
    }

    if (jobs.length > 100) {
      throw new ValidationError('Batch cannot exceed 100 jobs');
    }

    const errors = [];
    jobs.forEach((job, idx) => {
      try {
        this.validateJob(job);
      } catch (e) {
        errors.push(`Job[${idx}]: ${e.message}`);
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(errors.join('\n'));
    }

    return jobs;
  }

  /**
   * Validate job update (partial)
   */
  static validateJobUpdate(updates) {
    const allowedFields = [
      'status',
      'notes',
      'salary_min',
      'salary_max',
      'application_date',
      'application_url',
      'rejection_date',
      'rejection_reason',
      'interview_date',
      'interview_stage',
    ];

    for (const field of Object.keys(updates)) {
      if (!allowedFields.includes(field)) {
        throw new ValidationError(`Cannot update field: ${field}`);
      }
    }

    // Validate individual fields
    if (updates.status && !['new', 'saved', 'applied', 'rejected', 'archived'].includes(updates.status)) {
      throw new ValidationError('Invalid status');
    }

    if (updates.notes && typeof updates.notes !== 'string') {
      throw new ValidationError('Notes must be a string');
    }

    // Validate salary fields
    if (updates.salary_min !== undefined && updates.salary_min !== null && typeof updates.salary_min !== 'number') {
      throw new ValidationError('salary_min must be a number');
    }

    if (updates.salary_max !== undefined && updates.salary_max !== null && typeof updates.salary_max !== 'number') {
      throw new ValidationError('salary_max must be a number');
    }

    // Cross-field validation for salary
    if (updates.salary_min !== undefined && updates.salary_min !== null &&
        updates.salary_max !== undefined && updates.salary_max !== null &&
        updates.salary_min > updates.salary_max) {
      throw new ValidationError('salary_min must be less than or equal to salary_max');
    }

    return updates;
  }

  /**
   * Sanitize job title/company for XSS prevention
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    
    // First remove script tags with robust regex
    let sanitized = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // HTML-encode special characters (do & first to avoid double-encoding)
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .trim();
    
    return sanitized;
  }

  /**
   * Sanitize array of skill strings
   */
  static sanitizeSkills(skills) {
    if (!Array.isArray(skills)) return [];
    
    return skills
      .map(s => typeof s === 'string' ? this.sanitizeText(s).trim() : '')
      .filter(s => s.length > 0)
      .filter((s, idx, arr) => arr.indexOf(s) === idx); // Deduplicate
  }

  /**
   * Escape special characters for regex
   */
  static escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Custom validation error
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Filter validator
 */
class FilterValidator {
  static validateFilters(filters) {
    if (!filters || typeof filters !== 'object') {
      return {};
    }

    const validated = {};

    if (filters.status) {
      if (!Array.isArray(filters.status)) {
        throw new ValidationError('status must be an array');
      }
      const valid = ['new', 'saved', 'applied', 'rejected', 'archived'];
      const invalid = filters.status.filter(s => !valid.includes(s));
      if (invalid.length > 0) {
        throw new ValidationError(`Invalid statuses: ${invalid.join(', ')}`);
      }
      validated.status = filters.status;
    }

    if (filters.minMatchPercentage !== undefined) {
      const val = parseInt(filters.minMatchPercentage, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new ValidationError('minMatchPercentage must be 0-100');
      }
      validated.minMatchPercentage = val;
    }

    if (filters.rankingLevel) {
      if (!Array.isArray(filters.rankingLevel)) {
        throw new ValidationError('rankingLevel must be an array');
      }
      const valid = ['high', 'medium', 'low'];
      const invalid = filters.rankingLevel.filter(l => !valid.includes(l));
      if (invalid.length > 0) {
        throw new ValidationError(`Invalid ranking levels: ${invalid.join(', ')}`);
      }
      validated.rankingLevel = filters.rankingLevel;
    }

    return validated;
  }
}

/**
 * Pagination validator
 */
class PaginationValidator {
  static validatePagination(options) {
    // Handle null/undefined options safely
    options = options || {};
    const page = Math.max(1, parseInt(options.page || 1, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(options.pageSize || 10, 10)));

    return { page, pageSize };
  }
}

/**
 * Search query validator
 */
class SearchValidator {
  static validateSearchQuery(query) {
    if (typeof query !== 'string') return '';
    
    // Remove dangerous characters
    let safe = query.replace(/[<>]/g, '');
    
    // Limit length
    safe = safe.substring(0, 255);

    return safe.trim();
  }
}

/**
 * Export validators
 */
const validators = {
  JobValidator,
  FilterValidator,
  PaginationValidator,
  SearchValidator,
  ValidationError,
};
