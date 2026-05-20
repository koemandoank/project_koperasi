-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NULL,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('superadmin', 'admin', 'pengurus', 'kasir', 'anggota') NOT NULL DEFAULT 'anggota',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `mfa_secret` VARCHAR(100) NULL,
    `mfa_enabled` BOOLEAN NOT NULL DEFAULT false,
    `last_login_at` TIMESTAMP(0) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `remember_token` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `users_member_id_unique`(`member_id`),
    UNIQUE INDEX `users_username_unique`(`username`),
    UNIQUE INDEX `users_email_unique`(`email`),
    INDEX `users_role_is_active_index`(`role`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `payload` LONGTEXT NOT NULL,
    `last_activity` INTEGER NOT NULL,

    INDEX `sessions_last_activity_index`(`last_activity`),
    INDEX `sessions_user_id_index`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_code` VARCHAR(20) NOT NULL,
    `nik` VARCHAR(16) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `address` VARCHAR(255) NULL,
    `birth_date` DATE NULL,
    `gender` ENUM('male', 'female') NULL,
    `join_date` DATE NOT NULL,
    `photo_path` VARCHAR(255) NULL,
    `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `members_member_code_unique`(`member_code`),
    UNIQUE INDEX `members_nik_unique`(`nik`),
    UNIQUE INDEX `members_email_unique`(`email`),
    INDEX `members_status_unit_id_index`(`status`, `unit_id`),
    INDEX `members_unit_id_foreign`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('simpan_pinjam', 'toko', 'ppob', 'elearning', 'asuransi', 'investasi', 'induk') NOT NULL DEFAULT 'simpan_pinjam',
    `parent_id` BIGINT UNSIGNED NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `units_code_unique`(`code`),
    INDEX `units_parent_id_foreign`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(50) NOT NULL,
    `model_type` VARCHAR(100) NULL,
    `model_id` BIGINT UNSIGNED NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `url` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL,

    INDEX `audit_logs_created_at_index`(`created_at`),
    INDEX `audit_logs_model_type_model_id_index`(`model_type`, `model_id`),
    INDEX `audit_logs_user_id_created_at_index`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cache` (
    `key` VARCHAR(255) NOT NULL,
    `value` MEDIUMTEXT NOT NULL,
    `expiration` INTEGER NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cache_locks` (
    `key` VARCHAR(255) NOT NULL,
    `owner` VARCHAR(255) NOT NULL,
    `expiration` INTEGER NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chart_of_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
    `normal_balance` ENUM('debit', 'credit') NOT NULL,
    `parent_id` BIGINT UNSIGNED NULL,
    `level` SMALLINT NOT NULL DEFAULT 1,
    `is_header` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `chart_of_accounts_parent_id_foreign`(`parent_id`),
    INDEX `chart_of_accounts_unit_id_type_index`(`unit_id`, `type`),
    UNIQUE INDEX `uq_unit_account_code`(`unit_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `failed_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(255) NOT NULL,
    `connection` TEXT NOT NULL,
    `queue` TEXT NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `exception` LONGTEXT NOT NULL,
    `failed_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `failed_jobs_uuid_unique`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_batches` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `total_jobs` INTEGER NOT NULL,
    `pending_jobs` INTEGER NOT NULL,
    `failed_jobs` INTEGER NOT NULL,
    `failed_job_ids` LONGTEXT NOT NULL,
    `options` MEDIUMTEXT NULL,
    `cancelled_at` INTEGER NULL,
    `created_at` INTEGER NOT NULL,
    `finished_at` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `queue` VARCHAR(255) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `attempts` TINYINT UNSIGNED NOT NULL,
    `reserved_at` INTEGER UNSIGNED NULL,
    `available_at` INTEGER UNSIGNED NOT NULL,
    `created_at` INTEGER UNSIGNED NOT NULL,

    INDEX `jobs_queue_index`(`queue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `entry_no` VARCHAR(60) NOT NULL,
    `entry_date` DATE NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `source` ENUM('manual', 'saving', 'loan', 'loan_payment', 'pos', 'ppob', 'shu', 'adjustment') NOT NULL DEFAULT 'manual',
    `posted_by` BIGINT UNSIGNED NULL,
    `posted_at` TIMESTAMP(0) NULL,
    `is_posted` BOOLEAN NOT NULL DEFAULT false,
    `is_reversed` BOOLEAN NOT NULL DEFAULT false,
    `reversed_by_entry_id` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `journal_entries_entry_no_unique`(`entry_no`),
    INDEX `journal_entries_posted_by_foreign`(`posted_by`),
    INDEX `journal_entries_reversed_by_entry_id_foreign`(`reversed_by_entry_id`),
    INDEX `journal_entries_unit_id_entry_date_index`(`unit_id`, `entry_date`),
    INDEX `journal_entries_unit_id_is_posted_entry_date_index`(`unit_id`, `is_posted`, `entry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_lines` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `journal_id` BIGINT UNSIGNED NOT NULL,
    `account_id` BIGINT UNSIGNED NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `journal_lines_account_id_index`(`account_id`),
    INDEX `journal_lines_journal_id_index`(`journal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_applications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `loan_product_id` BIGINT UNSIGNED NOT NULL,
    `application_no` VARCHAR(60) NOT NULL,
    `amount_requested` DECIMAL(15, 2) NOT NULL,
    `tenor_months` SMALLINT NOT NULL,
    `repayment_method` ENUM('cash', 'salary_cut', 'saving_deduct') NOT NULL DEFAULT 'cash',
    `purpose` TEXT NOT NULL,
    `status` ENUM('draft', 'pending', 'under_review', 'approved', 'rejected', 'disbursed') NOT NULL DEFAULT 'draft',
    `submitted_at` TIMESTAMP(0) NULL,
    `reviewed_by` BIGINT UNSIGNED NULL,
    `reviewed_at` TIMESTAMP(0) NULL,
    `approved_by` BIGINT UNSIGNED NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `rejection_note` TEXT NULL,
    `guarantor_name` VARCHAR(150) NULL,
    `guarantor_phone` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `loan_applications_application_no_unique`(`application_no`),
    INDEX `loan_applications_approved_by_foreign`(`approved_by`),
    INDEX `loan_applications_loan_product_id_foreign`(`loan_product_id`),
    INDEX `loan_applications_member_id_status_index`(`member_id`, `status`),
    INDEX `loan_applications_reviewed_by_foreign`(`reviewed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `loan_id` BIGINT UNSIGNED NOT NULL,
    `schedule_id` BIGINT UNSIGNED NULL,
    `payment_no` VARCHAR(60) NOT NULL,
    `amount_paid` DECIMAL(15, 2) NOT NULL,
    `principal_portion` DECIMAL(15, 2) NOT NULL,
    `interest_portion` DECIMAL(15, 2) NOT NULL,
    `penalty_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `payment_method` ENUM('cash', 'salary_cut', 'saving_deduct', 'transfer') NOT NULL,
    `reference` VARCHAR(100) NULL,
    `processed_by` BIGINT UNSIGNED NULL,
    `paid_at` TIMESTAMP(0) NOT NULL,
    `note` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `loan_payments_payment_no_unique`(`payment_no`),
    INDEX `loan_payments_loan_id_paid_at_index`(`loan_id`, `paid_at`),
    INDEX `loan_payments_processed_by_foreign`(`processed_by`),
    INDEX `loan_payments_schedule_id_foreign`(`schedule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `interest_rate` DECIMAL(5, 2) NOT NULL,
    `interest_method` ENUM('flat', 'anuitas', 'efektif') NOT NULL DEFAULT 'flat',
    `max_tenor` SMALLINT NOT NULL,
    `max_amount` DECIMAL(15, 2) NOT NULL,
    `min_amount` DECIMAL(15, 2) NOT NULL DEFAULT 500000.00,
    `admin_fee_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `penalty_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `requires_guarantor` BOOLEAN NOT NULL DEFAULT false,
    `requirements` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `loan_products_code_unique`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_schedules` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `loan_id` BIGINT UNSIGNED NOT NULL,
    `installment_no` SMALLINT NOT NULL,
    `due_date` DATE NOT NULL,
    `principal_due` DECIMAL(15, 2) NOT NULL,
    `interest_due` DECIMAL(15, 2) NOT NULL,
    `total_due` DECIMAL(15, 2) NOT NULL,
    `principal_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `interest_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `penalty_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paid_at` TIMESTAMP(0) NULL,
    `status` ENUM('pending', 'partial', 'paid', 'overdue') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `loan_schedules_due_date_status_index`(`due_date`, `status`),
    INDEX `loan_schedules_loan_id_due_date_status_index`(`loan_id`, `due_date`, `status`),
    UNIQUE INDEX `uq_loan_installment`(`loan_id`, `installment_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `loan_no` VARCHAR(60) NOT NULL,
    `principal` DECIMAL(15, 2) NOT NULL,
    `interest_rate` DECIMAL(5, 2) NOT NULL,
    `interest_method` ENUM('flat', 'anuitas', 'efektif') NOT NULL,
    `admin_fee` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tenor_months` SMALLINT NOT NULL,
    `disbursed_at` DATE NOT NULL,
    `first_due_date` DATE NOT NULL,
    `last_due_date` DATE NOT NULL,
    `monthly_installment` DECIMAL(15, 2) NOT NULL,
    `outstanding_principal` DECIMAL(15, 2) NOT NULL,
    `total_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `repayment_method` ENUM('cash', 'salary_cut', 'saving_deduct') NOT NULL DEFAULT 'cash',
    `status` ENUM('active', 'paid_off', 'overdue', 'restructured', 'written_off') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `loans_application_id_unique`(`application_id`),
    UNIQUE INDEX `loans_loan_no_unique`(`loan_no`),
    INDEX `loans_member_id_status_index`(`member_id`, `status`),
    INDEX `loans_status_index`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `migrations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `migration` VARCHAR(255) NOT NULL,
    `batch` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `product_name` VARCHAR(200) NOT NULL,
    `qty` INTEGER NOT NULL,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `order_items_order_id_index`(`order_id`),
    INDEX `order_items_product_id_foreign`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(60) NOT NULL,
    `member_id` BIGINT UNSIGNED NULL,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `channel` ENUM('online', 'pos') NOT NULL DEFAULT 'pos',
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `grand_total` DECIMAL(15, 2) NOT NULL,
    `payment_method` ENUM('cash', 'saving_deduct', 'paylater', 'qris', 'transfer') NOT NULL DEFAULT 'cash',
    `payment_status` ENUM('unpaid', 'paid', 'partial', 'refunded') NOT NULL DEFAULT 'unpaid',
    `order_status` ENUM('pending', 'confirmed', 'processing', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    `cashier_id` BIGINT UNSIGNED NULL,
    `note` TEXT NULL,
    `delivery_address` VARCHAR(255) NULL,
    `ordered_at` TIMESTAMP(0) NOT NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `orders_order_no_unique`(`order_no`),
    INDEX `orders_cashier_id_foreign`(`cashier_id`),
    INDEX `orders_member_id_ordered_at_index`(`member_id`, `ordered_at`),
    INDEX `orders_payment_status_order_status_index`(`payment_status`, `order_status`),
    INDEX `orders_unit_id_ordered_at_index`(`unit_id`, `ordered_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `email` VARCHAR(255) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personal_access_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tokenable_type` VARCHAR(255) NOT NULL,
    `tokenable_id` BIGINT UNSIGNED NOT NULL,
    `name` TEXT NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `abilities` TEXT NULL,
    `last_used_at` TIMESTAMP(0) NULL,
    `expires_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `personal_access_tokens_token_unique`(`token`),
    INDEX `personal_access_tokens_expires_at_index`(`expires_at`),
    INDEX `personal_access_tokens_tokenable_type_tokenable_id_index`(`tokenable_type`, `tokenable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ppob_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `trx_no` VARCHAR(60) NOT NULL,
    `product_type` ENUM('pulsa', 'data', 'listrik', 'air', 'internet', 'bpjs', 'pajak', 'tv', 'other') NOT NULL,
    `product_code` VARCHAR(50) NOT NULL,
    `customer_no` VARCHAR(100) NOT NULL,
    `customer_name` VARCHAR(150) NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `admin_fee` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `payment_method` ENUM('saving_deduct', 'cash', 'transfer') NOT NULL DEFAULT 'saving_deduct',
    `provider_ref` VARCHAR(100) NULL,
    `sn` VARCHAR(255) NULL,
    `status` ENUM('pending', 'processing', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    `transacted_at` TIMESTAMP(0) NOT NULL,
    `completed_at` TIMESTAMP(0) NULL,
    `failure_reason` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `ppob_transactions_trx_no_unique`(`trx_no`),
    INDEX `ppob_transactions_member_id_transacted_at_index`(`member_id`, `transacted_at`),
    INDEX `ppob_transactions_status_transacted_at_index`(`status`, `transacted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `icon_url` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `product_categories_slug_unique`(`slug`),
    INDEX `product_categories_parent_id_foreign`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `sku` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `purchase_price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `price` DECIMAL(15, 2) NOT NULL,
    `member_price` DECIMAL(15, 2) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `min_stock` INTEGER NOT NULL DEFAULT 0,
    `unit_measure` VARCHAR(20) NOT NULL DEFAULT 'pcs',
    `image_path` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_online` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `products_sku_unique`(`sku`),
    INDEX `products_category_id_index`(`category_id`),
    INDEX `products_unit_id_is_active_index`(`unit_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saving_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `savings_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('deposit', 'withdraw', 'salary_cut', 'shu_credit', 'loan_deduct', 'pos_deduct', 'adjustment') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `balance_before` DECIMAL(15, 2) NOT NULL,
    `balance_after` DECIMAL(15, 2) NOT NULL,
    `reference_no` VARCHAR(60) NOT NULL,
    `note` TEXT NULL,
    `processed_by` BIGINT UNSIGNED NULL,
    `transaction_at` TIMESTAMP(0) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `saving_transactions_reference_no_unique`(`reference_no`),
    INDEX `saving_transactions_member_id_transaction_at_index`(`member_id`, `transaction_at`),
    INDEX `saving_transactions_processed_by_foreign`(`processed_by`),
    INDEX `saving_transactions_savings_id_transaction_at_index`(`savings_id`, `transaction_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saving_types` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_mandatory` BOOLEAN NOT NULL DEFAULT false,
    `min_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `monthly_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `is_withdrawable` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `saving_types_code_unique`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `savings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `saving_type_id` BIGINT UNSIGNED NOT NULL,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_deposit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_withdraw` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `savings_member_id_index`(`member_id`),
    INDEX `savings_saving_type_id_foreign`(`saving_type_id`),
    UNIQUE INDEX `uq_member_saving_type`(`member_id`, `saving_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shu_distributions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shu_period_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `savings_weight` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `activity_weight` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `shu_amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('pending', 'disbursed') NOT NULL DEFAULT 'pending',
    `disbursement_method` ENUM('saving_credit', 'cash', 'transfer') NULL,
    `disbursed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `shu_distributions_member_id_foreign`(`member_id`),
    UNIQUE INDEX `uq_shu_member`(`shu_period_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shu_periods` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `period_year` YEAR NOT NULL,
    `total_revenue` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_expense` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_shu` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `shu_for_member` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `shu_for_reserve` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `shu_for_pengurus` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `shu_for_education` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('draft', 'calculated', 'approved', 'distributed', 'closed') NOT NULL DEFAULT 'draft',
    `calculated_at` TIMESTAMP(0) NULL,
    `distributed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `uq_unit_shu_year`(`unit_id`, `period_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('in', 'out', 'adjustment', 'return', 'transfer') NOT NULL,
    `qty` INTEGER NOT NULL,
    `stock_before` INTEGER NOT NULL,
    `stock_after` INTEGER NOT NULL,
    `reference` VARCHAR(100) NULL,
    `note` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `stock_movements_created_by_foreign`(`created_by`),
    INDEX `stock_movements_product_id_created_at_index`(`product_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(150) NOT NULL DEFAULT 'Koperasi Digital',
    `address` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `logo_url` VARCHAR(255) NULL DEFAULT '/koperasi.png',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monthly_closures` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `month` SMALLINT NOT NULL,
    `year` SMALLINT NOT NULL,
    `total_revenue` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_expense` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_income` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `closed_by` BIGINT UNSIGNED NULL,
    `closed_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `notes` TEXT NULL,

    UNIQUE INDEX `monthly_closures_month_year_key`(`month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_registers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `register_no` VARCHAR(50) NOT NULL,
    `register_name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `cash_registers_register_no_key`(`register_no`),
    INDEX `cash_registers_unit_id_idx`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_register_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `cash_register_id` BIGINT UNSIGNED NOT NULL,
    `session_date` DATE NOT NULL,
    `opened_by` BIGINT UNSIGNED NOT NULL,
    `closed_by` BIGINT UNSIGNED NULL,
    `opening_balance` DECIMAL(15, 2) NOT NULL,
    `closing_balance` DECIMAL(15, 2) NULL,
    `expected_balance` DECIMAL(15, 2) NULL,
    `difference` DECIMAL(15, 2) NULL,
    `status` ENUM('open', 'closed', 'reconciled') NOT NULL DEFAULT 'open',
    `notes` TEXT NULL,
    `opened_at` TIMESTAMP(0) NOT NULL,
    `closed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `cash_register_sessions_cash_register_id_idx`(`cash_register_id`),
    INDEX `cash_register_sessions_session_date_status_idx`(`session_date`, `status`),
    UNIQUE INDEX `cash_register_sessions_cash_register_id_session_date_key`(`cash_register_id`, `session_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `payment_method` ENUM('cash', 'debit_card', 'credit_card', 'qris', 'transfer', 'check', 'other') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `reference_no` VARCHAR(100) NULL,
    `payment_status` ENUM('pending', 'authorized', 'captured', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    `paid_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `order_payments_order_id_idx`(`order_id`),
    INDEX `order_payments_payment_method_paid_at_idx`(`payment_method`, `paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_returns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `return_no` VARCHAR(60) NOT NULL,
    `reason` TEXT NOT NULL,
    `return_status` ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
    `refund_amount` DECIMAL(15, 2) NOT NULL,
    `refund_method` ENUM('cash', 'original_payment', 'store_credit', 'gift_card') NOT NULL,
    `processed_by` BIGINT UNSIGNED NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `completed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `order_returns_return_no_key`(`return_no`),
    INDEX `order_returns_order_id_idx`(`order_id`),
    INDEX `order_returns_return_status_idx`(`return_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouse_locations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `location_code` VARCHAR(50) NOT NULL,
    `location_name` VARCHAR(150) NOT NULL,
    `location_type` ENUM('main', 'branch', 'warehouse', 'kiosk') NOT NULL DEFAULT 'main',
    `address` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `warehouse_locations_location_code_key`(`location_code`),
    INDEX `warehouse_locations_unit_id_idx`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_balances` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `location_id` BIGINT UNSIGNED NOT NULL,
    `qty_on_hand` INTEGER NOT NULL DEFAULT 0,
    `qty_reserved` INTEGER NOT NULL DEFAULT 0,
    `qty_available` INTEGER NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `stock_balances_product_id_idx`(`product_id`),
    INDEX `stock_balances_location_id_idx`(`location_id`),
    UNIQUE INDEX `stock_balances_product_id_location_id_key`(`product_id`, `location_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_reorder_points` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `reorder_qty` INTEGER NOT NULL,
    `reorder_point` INTEGER NOT NULL,
    `lead_time_days` INTEGER NOT NULL DEFAULT 7,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `stock_reorder_points_product_id_key`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `transfer_no` VARCHAR(60) NOT NULL,
    `from_location_id` BIGINT UNSIGNED NOT NULL,
    `to_location_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('pending', 'in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
    `requested_by` BIGINT UNSIGNED NOT NULL,
    `approved_by` BIGINT UNSIGNED NULL,
    `transferred_by` BIGINT UNSIGNED NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `transferred_at` TIMESTAMP(0) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `stock_transfer_orders_transfer_no_key`(`transfer_no`),
    INDEX `stock_transfer_orders_from_location_id_idx`(`from_location_id`),
    INDEX `stock_transfer_orders_to_location_id_idx`(`to_location_id`),
    INDEX `stock_transfer_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `transfer_order_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `qty_requested` INTEGER NOT NULL,
    `qty_transferred` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `stock_transfer_items_transfer_order_id_idx`(`transfer_order_id`),
    INDEX `stock_transfer_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_opname` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `opname_no` VARCHAR(60) NOT NULL,
    `location_id` BIGINT UNSIGNED NULL,
    `opname_date` DATE NOT NULL,
    `status` ENUM('draft', 'in_progress', 'completed', 'approved') NOT NULL DEFAULT 'draft',
    `notes` TEXT NULL,
    `conducted_by` BIGINT UNSIGNED NOT NULL,
    `approved_by` BIGINT UNSIGNED NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `stock_opname_opname_no_key`(`opname_no`),
    INDEX `stock_opname_opname_date_status_idx`(`opname_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_opname_details` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `opname_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `qty_system` INTEGER NOT NULL,
    `qty_physical` INTEGER NOT NULL,
    `variance` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `stock_opname_details_opname_id_idx`(`opname_id`),
    INDEX `stock_opname_details_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_costing` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `costing_method` ENUM('fifo', 'lifo', 'average_cost', 'standard_cost') NOT NULL DEFAULT 'average_cost',
    `current_cost` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `product_costing_product_id_key`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consignment_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `consignment_date` DATE NOT NULL,
    `qty_received` INTEGER NOT NULL,
    `qty_sold` INTEGER NOT NULL DEFAULT 0,
    `qty_returned` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('active', 'returned', 'settled', 'closed') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `consignment_items_product_id_supplier_id_idx`(`product_id`, `supplier_id`),
    INDEX `consignment_items_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consignment_payables` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `consignment_id` BIGINT UNSIGNED NOT NULL,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `qty_sold` INTEGER NOT NULL,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('pending', 'partially_paid', 'paid') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `consignment_payables_supplier_id_status_idx`(`supplier_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consignment_settlements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `payable_id` BIGINT UNSIGNED NOT NULL,
    `settlement_no` VARCHAR(60) NOT NULL,
    `settlement_date` DATE NOT NULL,
    `amount_paid` DECIMAL(15, 2) NOT NULL,
    `payment_method` ENUM('cash', 'check', 'transfer', 'debit_card', 'credit_card', 'qris') NOT NULL,
    `reference_no` VARCHAR(100) NULL,
    `processed_by` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `consignment_settlements_settlement_no_key`(`settlement_no`),
    INDEX `consignment_settlements_payable_id_idx`(`payable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts_payable` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `invoice_no` VARCHAR(60) NOT NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `amount_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount_due` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('open', 'partial', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'open',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `accounts_payable_invoice_no_key`(`invoice_no`),
    INDEX `accounts_payable_supplier_id_status_idx`(`supplier_id`, `status`),
    INDEX `accounts_payable_due_date_status_idx`(`due_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts_payable_details` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ap_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `line_total` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `accounts_payable_details_ap_id_idx`(`ap_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts_receivable` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NULL,
    `customer_name` VARCHAR(150) NOT NULL,
    `invoice_no` VARCHAR(60) NOT NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `amount_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount_due` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('open', 'partial', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'open',
    `credit_limit` DECIMAL(15, 2) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `accounts_receivable_invoice_no_key`(`invoice_no`),
    INDEX `accounts_receivable_member_id_status_idx`(`member_id`, `status`),
    INDEX `accounts_receivable_due_date_status_idx`(`due_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts_receivable_details` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ar_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `line_total` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `accounts_receivable_details_ar_id_idx`(`ar_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_calculations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NULL,
    `invoice_id` VARCHAR(60) NULL,
    `tax_type` ENUM('ppn', 'pph', 'other') NOT NULL,
    `tax_percentage` DECIMAL(5, 2) NOT NULL,
    `taxable_amount` DECIMAL(15, 2) NOT NULL,
    `tax_amount` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `tax_calculations_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `supplier_code` VARCHAR(50) NOT NULL,
    `supplier_name` VARCHAR(200) NOT NULL,
    `contact_person` VARCHAR(150) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(50) NULL,
    `payment_terms` SMALLINT NULL,
    `avg_delivery_days` SMALLINT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `suppliers_supplier_code_key`(`supplier_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `po_no` VARCHAR(60) NOT NULL,
    `po_date` DATE NOT NULL,
    `expected_delivery` DATE NOT NULL,
    `status` ENUM('draft', 'submitted', 'approved', 'partial_received', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `approved_by` BIGINT UNSIGNED NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `purchase_orders_po_no_key`(`po_no`),
    INDEX `purchase_orders_supplier_id_status_idx`(`supplier_id`, `status`),
    INDEX `purchase_orders_po_date_idx`(`po_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `po_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `qty_ordered` INTEGER NOT NULL,
    `qty_received` INTEGER NOT NULL DEFAULT 0,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `line_total` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `purchase_order_items_po_id_idx`(`po_id`),
    INDEX `purchase_order_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `good_receipts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `po_id` BIGINT UNSIGNED NOT NULL,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `gr_no` VARCHAR(60) NOT NULL,
    `gr_date` DATE NOT NULL,
    `status` ENUM('received', 'inspected', 'accepted', 'rejected', 'partially_accepted') NOT NULL DEFAULT 'received',
    `received_by` BIGINT UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `good_receipts_gr_no_key`(`gr_no`),
    INDEX `good_receipts_po_id_idx`(`po_id`),
    INDEX `good_receipts_gr_date_idx`(`gr_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `good_receipt_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `gr_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `qty_received` INTEGER NOT NULL,
    `qty_accepted` INTEGER NOT NULL DEFAULT 0,
    `qty_rejected` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `good_receipt_items_gr_id_idx`(`gr_id`),
    INDEX `good_receipt_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_workflows` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `workflow_code` VARCHAR(50) NOT NULL,
    `workflow_name` VARCHAR(150) NOT NULL,
    `module_type` ENUM('transaction', 'purchase', 'inventory', 'financial', 'payroll') NOT NULL,
    `action_type` ENUM('create', 'update', 'delete', 'approve', 'reject', 'void') NOT NULL,
    `requires_approval` BOOLEAN NOT NULL DEFAULT true,
    `approval_levels` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `approval_workflows_workflow_code_key`(`workflow_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `workflow_id` BIGINT UNSIGNED NOT NULL,
    `reference_type` VARCHAR(100) NOT NULL,
    `reference_id` BIGINT UNSIGNED NOT NULL,
    `requested_by` BIGINT UNSIGNED NOT NULL,
    `current_level` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `rejection_reason` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `approved_by` BIGINT UNSIGNED NULL,

    INDEX `approval_requests_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `approval_requests_status_current_level_idx`(`status`, `current_level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_programs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `program_code` VARCHAR(50) NOT NULL,
    `program_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `points_per_rupiah` DECIMAL(10, 6) NOT NULL,
    `minimum_purchase` DECIMAL(15, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `loyalty_programs_program_code_key`(`program_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_memberships` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `program_id` BIGINT UNSIGNED NOT NULL,
    `membership_level` ENUM('bronze', 'silver', 'gold', 'platinum') NOT NULL DEFAULT 'bronze',
    `total_points` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `points_used` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `points_available` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `member_since` DATE NOT NULL,
    `last_activity` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `loyalty_memberships_member_id_membership_level_idx`(`member_id`, `membership_level`),
    UNIQUE INDEX `loyalty_memberships_member_id_program_id_key`(`member_id`, `program_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_redemptions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `membership_id` BIGINT UNSIGNED NOT NULL,
    `program_id` BIGINT UNSIGNED NOT NULL,
    `order_id` BIGINT UNSIGNED NULL,
    `points_redeemed` DECIMAL(15, 2) NOT NULL,
    `discount_amount` DECIMAL(15, 2) NOT NULL,
    `redemption_date` TIMESTAMP(0) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `loyalty_redemptions_membership_id_redemption_date_idx`(`membership_id`, `redemption_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_tiers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `tier_name` ENUM('retail', 'wholesale', 'vip', 'distributor') NOT NULL,
    `min_qty` INTEGER NOT NULL DEFAULT 1,
    `price` DECIMAL(15, 2) NOT NULL,
    `discount_pct` DECIMAL(5, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `price_tiers_product_id_tier_name_idx`(`product_id`, `tier_name`),
    UNIQUE INDEX `price_tiers_product_id_tier_name_min_qty_key`(`product_id`, `tier_name`, `min_qty`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_segments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `segment_code` VARCHAR(50) NOT NULL,
    `segment_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `min_purchase_amt` DECIMAL(15, 2) NULL,
    `max_purchase_amt` DECIMAL(15, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `customer_segments_segment_code_key`(`segment_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_analytics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `unit_id` BIGINT UNSIGNED NOT NULL,
    `total_sales` DECIMAL(15, 2) NOT NULL,
    `total_transactions` INTEGER NOT NULL,
    `avg_transaction` DECIMAL(15, 2) NOT NULL,
    `cash_sales` DECIMAL(15, 2) NOT NULL,
    `credit_sales` DECIMAL(15, 2) NOT NULL,
    `gross_margin` DECIMAL(15, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `sales_analytics_date_idx`(`date`),
    UNIQUE INDEX `sales_analytics_date_unit_id_key`(`date`, `unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_analytics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `period_date` DATE NOT NULL,
    `qty_sold` INTEGER NOT NULL,
    `revenue` DECIMAL(15, 2) NOT NULL,
    `turn_ratio` DECIMAL(10, 2) NOT NULL,
    `last_sold_date` DATE NULL,
    `days_in_stock` INTEGER NULL,
    `movement_status` ENUM('fast_moving', 'normal', 'slow_moving', 'dead_stock') NOT NULL DEFAULT 'normal',
    `created_at` TIMESTAMP(0) NULL,

    INDEX `product_analytics_product_id_movement_status_idx`(`product_id`, `movement_status`),
    UNIQUE INDEX `product_analytics_product_id_period_date_key`(`product_id`, `period_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_posted_by_foreign` FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_reversed_by_entry_id_foreign` FOREIGN KEY (`reversed_by_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_journal_id_foreign` FOREIGN KEY (`journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_loan_product_id_foreign` FOREIGN KEY (`loan_product_id`) REFERENCES `loan_products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_payments` ADD CONSTRAINT `loan_payments_loan_id_foreign` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_payments` ADD CONSTRAINT `loan_payments_processed_by_foreign` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_payments` ADD CONSTRAINT `loan_payments_schedule_id_foreign` FOREIGN KEY (`schedule_id`) REFERENCES `loan_schedules`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loan_schedules` ADD CONSTRAINT `loan_schedules_loan_id_foreign` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_application_id_foreign` FOREIGN KEY (`application_id`) REFERENCES `loan_applications`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_cashier_id_foreign` FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `ppob_transactions` ADD CONSTRAINT `ppob_transactions_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `product_categories`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `saving_transactions` ADD CONSTRAINT `saving_transactions_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `saving_transactions` ADD CONSTRAINT `saving_transactions_processed_by_foreign` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `saving_transactions` ADD CONSTRAINT `saving_transactions_savings_id_foreign` FOREIGN KEY (`savings_id`) REFERENCES `savings`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `savings` ADD CONSTRAINT `savings_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `savings` ADD CONSTRAINT `savings_saving_type_id_foreign` FOREIGN KEY (`saving_type_id`) REFERENCES `saving_types`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shu_distributions` ADD CONSTRAINT `shu_distributions_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shu_distributions` ADD CONSTRAINT `shu_distributions_shu_period_id_foreign` FOREIGN KEY (`shu_period_id`) REFERENCES `shu_periods`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shu_periods` ADD CONSTRAINT `shu_periods_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `cash_registers` ADD CONSTRAINT `cash_registers_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `cash_register_sessions` ADD CONSTRAINT `cash_register_sessions_cash_register_id_foreign` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_payments` ADD CONSTRAINT `order_payments_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_returns` ADD CONSTRAINT `order_returns_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_returns` ADD CONSTRAINT `order_returns_processed_by_foreign` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `warehouse_locations` ADD CONSTRAINT `warehouse_locations_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `warehouse_locations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_reorder_points` ADD CONSTRAINT `stock_reorder_points_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_transfer_orders` ADD CONSTRAINT `stock_transfer_from_location_foreign` FOREIGN KEY (`from_location_id`) REFERENCES `warehouse_locations`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_transfer_orders` ADD CONSTRAINT `stock_transfer_to_location_foreign` FOREIGN KEY (`to_location_id`) REFERENCES `warehouse_locations`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_order_foreign` FOREIGN KEY (`transfer_order_id`) REFERENCES `stock_transfer_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_opname_details` ADD CONSTRAINT `stock_opname_details_opname_foreign` FOREIGN KEY (`opname_id`) REFERENCES `stock_opname`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_opname_details` ADD CONSTRAINT `stock_opname_details_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product_costing` ADD CONSTRAINT `product_costing_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consignment_items` ADD CONSTRAINT `consignment_items_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consignment_items` ADD CONSTRAINT `consignment_items_supplier_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consignment_payables` ADD CONSTRAINT `consignment_payables_consignment_foreign` FOREIGN KEY (`consignment_id`) REFERENCES `consignment_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consignment_payables` ADD CONSTRAINT `consignment_payables_supplier_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consignment_settlements` ADD CONSTRAINT `consignment_settlements_payable_foreign` FOREIGN KEY (`payable_id`) REFERENCES `consignment_payables`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `consignment_settlements` ADD CONSTRAINT `consignment_settlements_user_foreign` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts_payable` ADD CONSTRAINT `accounts_payable_supplier_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts_payable_details` ADD CONSTRAINT `ap_details_ap_foreign` FOREIGN KEY (`ap_id`) REFERENCES `accounts_payable`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts_payable_details` ADD CONSTRAINT `ap_details_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts_receivable` ADD CONSTRAINT `accounts_receivable_member_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts_receivable_details` ADD CONSTRAINT `ar_details_ar_foreign` FOREIGN KEY (`ar_id`) REFERENCES `accounts_receivable`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts_receivable_details` ADD CONSTRAINT `ar_details_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `po_items_po_foreign` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `po_items_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `good_receipts` ADD CONSTRAINT `good_receipts_po_foreign` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `good_receipts` ADD CONSTRAINT `good_receipts_supplier_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `good_receipt_items` ADD CONSTRAINT `gr_items_gr_foreign` FOREIGN KEY (`gr_id`) REFERENCES `good_receipts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `good_receipt_items` ADD CONSTRAINT `gr_items_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_workflow_foreign` FOREIGN KEY (`workflow_id`) REFERENCES `approval_workflows`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loyalty_memberships` ADD CONSTRAINT `loyalty_memberships_member_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loyalty_memberships` ADD CONSTRAINT `loyalty_memberships_program_foreign` FOREIGN KEY (`program_id`) REFERENCES `loyalty_programs`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `loyalty_redemptions` ADD CONSTRAINT `loyalty_redemptions_program_foreign` FOREIGN KEY (`program_id`) REFERENCES `loyalty_programs`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `price_tiers` ADD CONSTRAINT `price_tiers_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product_analytics` ADD CONSTRAINT `product_analytics_product_foreign` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
