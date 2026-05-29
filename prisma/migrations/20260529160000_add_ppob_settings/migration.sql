-- AlterTable
ALTER TABLE `app_settings` ADD COLUMN `loan_rules` TEXT NULL;

-- AlterTable
ALTER TABLE `consignment_items` ADD COLUMN `return_date` TIMESTAMP(0) NULL,
    ADD COLUMN `return_reason` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `purchase_price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `ppob_transactions` MODIFY `payment_method` ENUM('saving_deduct', 'cash', 'transfer', 'paylater') NOT NULL DEFAULT 'paylater';

-- AlterTable
ALTER TABLE `products` ADD COLUMN `restock_requested` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('superadmin', 'admin', 'pengurus', 'kasir', 'anggota', 'petugas_akuntan', 'pengawas') NOT NULL DEFAULT 'anggota';

-- CreateTable
CREATE TABLE `ppob_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `api_key` VARCHAR(255) NOT NULL,
    `private_key` VARCHAR(255) NOT NULL,
    `merchant_code` VARCHAR(100) NOT NULL,
    `environment` VARCHAR(20) NOT NULL DEFAULT 'sandbox',
    `default_margin` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `shu_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `dynamic_pricing_by_level` BOOLEAN NOT NULL DEFAULT true,
    `webhook_url` VARCHAR(255) NULL,
    `enable_pulsa` BOOLEAN NOT NULL DEFAULT true,
    `enable_pln` BOOLEAN NOT NULL DEFAULT true,
    `enable_ewallet` BOOLEAN NOT NULL DEFAULT true,
    `enable_bills` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budgets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `allocated` DECIMAL(15, 2) NOT NULL,
    `used` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `color` VARCHAR(50) NOT NULL DEFAULT 'bg-indigo-600',
    `year` INTEGER NOT NULL DEFAULT 2026,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `budgets_code_unique`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rat_attendances` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `year` YEAR NOT NULL,
    `is_present` BOOLEAN NOT NULL DEFAULT true,
    `voted` BOOLEAN NOT NULL DEFAULT false,
    `attended_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `rat_attendance_year_index`(`year`),
    UNIQUE INDEX `uq_member_year_rat`(`member_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rat_attendances` ADD CONSTRAINT `rat_attendance_member_id_foreign` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
