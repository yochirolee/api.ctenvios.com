-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'RECEIVED', 'DISCREPANCY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('ERROR', 'WARN', 'INFO', 'HTTP', 'DEBUG');

-- CreateEnum
CREATE TYPE "AgencyType" AS ENUM ('AGENCY', 'RESELLER', 'FORWARDER');

-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('ROOT', 'ADMINISTRATOR', 'FORWARDER_RESELLER', 'AGENCY_SALES', 'AGENCY_ADMIN', 'AGENCY_SUPERVISOR', 'FORWARDER_ADMIN', 'CARRIER_ADMIN', 'MESSENGER', 'USER');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SHIPPING', 'DELIVERY', 'CUSTOMS');

-- CreateEnum
CREATE TYPE "RateScope" AS ENUM ('PUBLIC', 'WHOLESALE');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('PER_LB', 'PER_KG', 'FIXED', 'PER_CITY', 'PER_VALUE');

-- CreateEnum
CREATE TYPE "SurchargeType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'FULL_DISCOUNT', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'PAYPAL', 'ZELLE', 'CHECK');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'CASH', 'RATE', 'FIXED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('MARITIME', 'AIR');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('UNIT', 'WEIGHT', 'VALUE');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('PAYMENT', 'PRIVATE_TRACKING', 'PUBLIC_TRACKING', 'SYSTEM_ACTION', 'ISSUE_REPORTED');

-- CreateEnum
CREATE TYPE "OrderStage" AS ENUM ('BILLING', 'WAREHOUSE', 'TRANSPORT', 'DELIVERY', 'COMPLETED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('IN_AGENCY', 'IN_PALLET', 'IN_DISPATCH', 'RECEIVED_IN_DISPATCH', 'IN_WAREHOUSE', 'IN_CONTAINER', 'IN_TRANSIT', 'AT_PORT_OF_ENTRY', 'CUSTOMS_INSPECTION', 'RELEASED_FROM_CUSTOMS', 'OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERED', 'RETURNED_TO_SENDER');

-- CreateEnum
CREATE TYPE "CityType" AS ENUM ('SPECIAL', 'CAPITAL', 'CITY');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('COMPLAINT', 'DAMAGE', 'LOSS', 'DELAY', 'MISSING_ITEM', 'WRONG_ADDRESS', 'OTHER');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "forwarder_id" INTEGER,
    "agency_id" INTEGER,
    "role" "Roles" NOT NULL DEFAULT 'AGENCY_SALES',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "logo" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "forwarder_id" INTEGER NOT NULL,
    "parent_agency_id" INTEGER,
    "agency_type" "AgencyType" NOT NULL DEFAULT 'AGENCY',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "commission_rate" DOUBLE PRECISION DEFAULT 0.0,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "second_last_name" TEXT,
    "identity_document" TEXT,
    "email" TEXT,
    "mobile" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "agency_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receiver" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "second_last_name" TEXT,
    "passport" TEXT,
    "ci" VARCHAR(11) NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "agency_id" INTEGER,
    "province_id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,

    CONSTRAINT "Receiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "partner_order_id" TEXT,
    "customer_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "total_in_cents" INTEGER NOT NULL DEFAULT 0,
    "paid_in_cents" INTEGER NOT NULL DEFAULT 0,
    "requires_home_delivery" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "OrderStage" NOT NULL DEFAULT 'BILLING',
    "status" "Status" NOT NULL DEFAULT 'IN_AGENCY',
    "partner_id" INTEGER,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "hbl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "weight" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "volume" DOUBLE PRECISION DEFAULT 0,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "service_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_in_cents" INTEGER NOT NULL DEFAULT 0,
    "unit" "Unit" NOT NULL DEFAULT 'PER_LB',
    "delivery_fee_in_cents" INTEGER DEFAULT 0,
    "customs_fee_in_cents" INTEGER NOT NULL DEFAULT 0,
    "insurance_fee_in_cents" INTEGER DEFAULT 0,
    "charge_fee_in_cents" INTEGER DEFAULT 0,
    "rate_id" INTEGER NOT NULL,
    "customs_rates_id" INTEGER,
    "agency_id" INTEGER NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'IN_AGENCY',
    "order_id" INTEGER NOT NULL,
    "parcel_id" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("hbl")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" SERIAL NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "agency_id" INTEGER,
    "current_agency_id" INTEGER,
    "order_id" INTEGER,
    "service_id" INTEGER,
    "description" TEXT NOT NULL,
    "weight" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "status" "Status" NOT NULL DEFAULT 'IN_AGENCY',
    "current_location_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dispatch_id" INTEGER,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelEvent" (
    "id" SERIAL NOT NULL,
    "parcel_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'IN_AGENCY',
    "user_id" TEXT NOT NULL,
    "location_id" INTEGER,

    CONSTRAINT "ParcelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" SERIAL NOT NULL,
    "sender_agency_id" INTEGER NOT NULL,
    "receiver_agency_id" INTEGER,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "declared_parcels_count" INTEGER NOT NULL DEFAULT 0,
    "received_parcels_count" INTEGER NOT NULL DEFAULT 0,
    "declared_weight" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "weight" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "declared_cost_in_cents" INTEGER NOT NULL DEFAULT 0,
    "cost_in_cents" INTEGER NOT NULL DEFAULT 0,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "payment_reference" TEXT,
    "payment_notes" TEXT,
    "paid_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "received_by_id" TEXT,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'SHIPPING',
    "unit" "Unit" NOT NULL DEFAULT 'PER_LB',
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingAgreement" (
    "id" SERIAL NOT NULL,
    "seller_agency_id" INTEGER NOT NULL,
    "buyer_agency_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "price_in_cents" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "pricing_agreement_id" INTEGER NOT NULL,
    "scope" "RateScope" NOT NULL DEFAULT 'PUBLIC',
    "price_in_cents" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "product_id" INTEGER NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomsRates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country_id" INTEGER NOT NULL DEFAULT 1,
    "chapter" TEXT,
    "custom_value" DOUBLE PRECISION,
    "price_in_cup" DOUBLE PRECISION,
    "fee_type" "FeeType" NOT NULL DEFAULT 'UNIT',
    "fee_in_cents" INTEGER NOT NULL DEFAULT 0,
    "min_weight" DOUBLE PRECISION,
    "max_weight" DOUBLE PRECISION,
    "max_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "agencyId" INTEGER,

    CONSTRAINT "CustomsRates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateTier" (
    "id" SERIAL NOT NULL,
    "shipping_rate_id" INTEGER NOT NULL,
    "from_weight" DOUBLE PRECISION NOT NULL,
    "to_weight" DOUBLE PRECISION,
    "price_in_cents" INTEGER NOT NULL,

    CONSTRAINT "RateTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Surcharge" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "SurchargeType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "service_id" INTEGER,
    "agency_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "Surcharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forwarder" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forwarder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "forwarder_id" INTEGER NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "carrier_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "volumetric_divisor" INTEGER,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "forwarder_id" INTEGER NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Province" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "province_id" INTEGER NOT NULL,
    "city_type" "CityType" NOT NULL DEFAULT 'CITY',

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "agency_id" INTEGER NOT NULL,
    "forwarder_id" INTEGER NOT NULL,
    "rate_limit" INTEGER DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "name" TEXT,
    "partner_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "events" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status_code" INTEGER,
    "response" TEXT,
    "is_success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerLog" (
    "id" SERIAL NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "request_body" JSONB,
    "response_body" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "changed_fields" JSONB NOT NULL,
    "type" "OrderEventType" NOT NULL DEFAULT 'SYSTEM_ACTION',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "amount_in_cents" INTEGER NOT NULL DEFAULT 0,
    "charge_in_cents" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "description" TEXT,
    "rate" INTEGER DEFAULT 0,
    "discount_in_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_log" (
    "id" SERIAL NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "code" TEXT,
    "status_code" INTEGER,
    "details" JSONB,
    "stack" TEXT,
    "path" TEXT,
    "method" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "IssueType" NOT NULL DEFAULT 'COMPLAINT',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "order_id" INTEGER,
    "parcel_id" INTEGER,
    "order_item_hbl" TEXT,
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "agency_id" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueComment" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueAttachment" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueParcel" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "parcel_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueParcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyIssue" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "IssueType" NOT NULL DEFAULT 'COMPLAINT',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "legacy_invoice_id" INTEGER,
    "legacy_order_id" INTEGER,
    "legacy_parcel_id" INTEGER,
    "legacy_hbl" TEXT,
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyIssueParcel" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "legacy_parcel_id" TEXT NOT NULL,
    "legacy_order_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyIssueParcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyIssueComment" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyIssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyIssueAttachment" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyIssueAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgencyToService" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AgencyToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CustomerToReceiver" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CustomerToReceiver_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProductToService" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProductToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ForwarderToProvider" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ForwarderToProvider_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_agency_id_role_idx" ON "user"("agency_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_email_key" ON "Agency"("email");

-- CreateIndex
CREATE INDEX "Agency_forwarder_id_is_active_idx" ON "Agency"("forwarder_id", "is_active");

-- CreateIndex
CREATE INDEX "Agency_parent_agency_id_idx" ON "Agency"("parent_agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_identity_document_key" ON "Customer"("identity_document");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_agency_id_created_at_idx" ON "Customer"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Customer_created_at_idx" ON "Customer"("created_at" DESC);

-- CreateIndex
CREATE INDEX "Customer_id_idx" ON "Customer"("id");

-- CreateIndex
CREATE INDEX "Customer_first_name_last_name_idx" ON "Customer"("first_name", "last_name");

-- CreateIndex
CREATE INDEX "Customer_mobile_idx" ON "Customer"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobile_first_name_last_name_key" ON "Customer"("mobile", "first_name", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "Receiver_passport_key" ON "Receiver"("passport");

-- CreateIndex
CREATE UNIQUE INDEX "Receiver_ci_key" ON "Receiver"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "Receiver_email_key" ON "Receiver"("email");

-- CreateIndex
CREATE INDEX "Receiver_mobile_idx" ON "Receiver"("mobile");

-- CreateIndex
CREATE INDEX "Receiver_ci_idx" ON "Receiver"("ci");

-- CreateIndex
CREATE INDEX "Receiver_first_name_last_name_idx" ON "Receiver"("first_name", "last_name");

-- CreateIndex
CREATE INDEX "Receiver_agency_id_idx" ON "Receiver"("agency_id");

-- CreateIndex
CREATE INDEX "Order_agency_id_created_at_idx" ON "Order"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Order_created_at_idx" ON "Order"("created_at" DESC);

-- CreateIndex
CREATE INDEX "Order_customer_id_idx" ON "Order"("customer_id");

-- CreateIndex
CREATE INDEX "Order_receiver_id_idx" ON "Order"("receiver_id");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItem_hbl_idx" ON "OrderItem"("hbl");

-- CreateIndex
CREATE INDEX "OrderItem_agency_id_created_at_idx" ON "OrderItem"("agency_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_tracking_number_key" ON "Parcel"("tracking_number");

-- CreateIndex
CREATE INDEX "Parcel_tracking_number_idx" ON "Parcel"("tracking_number");

-- CreateIndex
CREATE INDEX "Parcel_dispatch_id_idx" ON "Parcel"("dispatch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_provider_id_name_key" ON "Product"("provider_id", "name");

-- CreateIndex
CREATE INDEX "PricingAgreement_seller_agency_id_buyer_agency_id_product_i_idx" ON "PricingAgreement"("seller_agency_id", "buyer_agency_id", "product_id", "service_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "PricingAgreement_seller_agency_id_buyer_agency_id_product_i_key" ON "PricingAgreement"("seller_agency_id", "buyer_agency_id", "product_id", "service_id");

-- CreateIndex
CREATE INDEX "ShippingRate_agency_id_service_id_scope_is_active_idx" ON "ShippingRate"("agency_id", "service_id", "scope", "is_active");

-- CreateIndex
CREATE INDEX "ShippingRate_service_id_is_active_idx" ON "ShippingRate"("service_id", "is_active");

-- CreateIndex
CREATE INDEX "CustomsRates_country_id_fee_type_idx" ON "CustomsRates"("country_id", "fee_type");

-- CreateIndex
CREATE INDEX "CustomsRates_id_idx" ON "CustomsRates"("id");

-- CreateIndex
CREATE INDEX "RateTier_shipping_rate_id_idx" ON "RateTier"("shipping_rate_id");

-- CreateIndex
CREATE INDEX "Surcharge_agency_id_service_id_is_active_idx" ON "Surcharge"("agency_id", "service_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Forwarder_name_key" ON "Forwarder"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_name_key" ON "Carrier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "ApiKey_partner_id_is_active_idx" ON "ApiKey"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "ApiKey_key_hash_idx" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "PartnerLog_api_key_id_created_at_idx" ON "PartnerLog"("api_key_id", "created_at");

-- CreateIndex
CREATE INDEX "PartnerLog_partner_id_created_at_idx" ON "PartnerLog"("partner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_date_agency_id_key" ON "Counter"("date", "agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_identifier_value_key" ON "verification"("identifier", "value");

-- CreateIndex
CREATE INDEX "app_log_level_created_at_idx" ON "app_log"("level", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_log_source_created_at_idx" ON "app_log"("source", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_log_status_code_created_at_idx" ON "app_log"("status_code", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_log_user_id_created_at_idx" ON "app_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_log_path_created_at_idx" ON "app_log"("path", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_log_created_at_idx" ON "app_log"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "app_config_key_key" ON "app_config"("key");

-- CreateIndex
CREATE INDEX "Issue_order_id_created_at_idx" ON "Issue"("order_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Issue_parcel_id_created_at_idx" ON "Issue"("parcel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Issue_order_item_hbl_idx" ON "Issue"("order_item_hbl");

-- CreateIndex
CREATE INDEX "Issue_status_created_at_idx" ON "Issue"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Issue_agency_id_status_idx" ON "Issue"("agency_id", "status");

-- CreateIndex
CREATE INDEX "Issue_created_by_id_created_at_idx" ON "Issue"("created_by_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Issue_assigned_to_id_status_idx" ON "Issue"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "Issue_created_at_idx" ON "Issue"("created_at" DESC);

-- CreateIndex
CREATE INDEX "IssueComment_issue_id_created_at_idx" ON "IssueComment"("issue_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "IssueComment_user_id_idx" ON "IssueComment"("user_id");

-- CreateIndex
CREATE INDEX "IssueAttachment_issue_id_created_at_idx" ON "IssueAttachment"("issue_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "IssueAttachment_uploaded_by_id_idx" ON "IssueAttachment"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "IssueParcel_issue_id_idx" ON "IssueParcel"("issue_id");

-- CreateIndex
CREATE INDEX "IssueParcel_parcel_id_idx" ON "IssueParcel"("parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "IssueParcel_issue_id_parcel_id_key" ON "IssueParcel"("issue_id", "parcel_id");

-- CreateIndex
CREATE INDEX "LegacyIssue_legacy_invoice_id_idx" ON "LegacyIssue"("legacy_invoice_id");

-- CreateIndex
CREATE INDEX "LegacyIssue_legacy_order_id_idx" ON "LegacyIssue"("legacy_order_id");

-- CreateIndex
CREATE INDEX "LegacyIssue_legacy_parcel_id_idx" ON "LegacyIssue"("legacy_parcel_id");

-- CreateIndex
CREATE INDEX "LegacyIssue_legacy_hbl_idx" ON "LegacyIssue"("legacy_hbl");

-- CreateIndex
CREATE INDEX "LegacyIssue_status_created_at_idx" ON "LegacyIssue"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "LegacyIssue_created_by_id_created_at_idx" ON "LegacyIssue"("created_by_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "LegacyIssue_assigned_to_id_status_idx" ON "LegacyIssue"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "LegacyIssue_created_at_idx" ON "LegacyIssue"("created_at" DESC);

-- CreateIndex
CREATE INDEX "LegacyIssueParcel_issue_id_idx" ON "LegacyIssueParcel"("issue_id");

-- CreateIndex
CREATE INDEX "LegacyIssueParcel_legacy_parcel_id_idx" ON "LegacyIssueParcel"("legacy_parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyIssueParcel_issue_id_legacy_parcel_id_key" ON "LegacyIssueParcel"("issue_id", "legacy_parcel_id");

-- CreateIndex
CREATE INDEX "LegacyIssueComment_issue_id_created_at_idx" ON "LegacyIssueComment"("issue_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "LegacyIssueComment_user_id_idx" ON "LegacyIssueComment"("user_id");

-- CreateIndex
CREATE INDEX "LegacyIssueAttachment_issue_id_created_at_idx" ON "LegacyIssueAttachment"("issue_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "LegacyIssueAttachment_uploaded_by_id_idx" ON "LegacyIssueAttachment"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "_AgencyToService_B_index" ON "_AgencyToService"("B");

-- CreateIndex
CREATE INDEX "_CustomerToReceiver_B_index" ON "_CustomerToReceiver"("B");

-- CreateIndex
CREATE INDEX "_ProductToService_B_index" ON "_ProductToService"("B");

-- CreateIndex
CREATE INDEX "_ForwarderToProvider_B_index" ON "_ForwarderToProvider"("B");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_parent_agency_id_fkey" FOREIGN KEY ("parent_agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiver" ADD CONSTRAINT "Receiver_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiver" ADD CONSTRAINT "Receiver_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiver" ADD CONSTRAINT "Receiver_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "Receiver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "ShippingRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_customs_rates_id_fkey" FOREIGN KEY ("customs_rates_id") REFERENCES "CustomsRates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_sender_agency_id_fkey" FOREIGN KEY ("sender_agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_receiver_agency_id_fkey" FOREIGN KEY ("receiver_agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingAgreement" ADD CONSTRAINT "PricingAgreement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingAgreement" ADD CONSTRAINT "PricingAgreement_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_pricing_agreement_id_fkey" FOREIGN KEY ("pricing_agreement_id") REFERENCES "PricingAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomsRates" ADD CONSTRAINT "CustomsRates_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomsRates" ADD CONSTRAINT "CustomsRates_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateTier" ADD CONSTRAINT "RateTier_shipping_rate_id_fkey" FOREIGN KEY ("shipping_rate_id") REFERENCES "ShippingRate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "Forwarder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLog" ADD CONSTRAINT "PartnerLog_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLog" ADD CONSTRAINT "PartnerLog_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_log" ADD CONSTRAINT "app_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_order_item_hbl_fkey" FOREIGN KEY ("order_item_hbl") REFERENCES "OrderItem"("hbl") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAttachment" ADD CONSTRAINT "IssueAttachment_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAttachment" ADD CONSTRAINT "IssueAttachment_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueParcel" ADD CONSTRAINT "IssueParcel_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueParcel" ADD CONSTRAINT "IssueParcel_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssue" ADD CONSTRAINT "LegacyIssue_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssue" ADD CONSTRAINT "LegacyIssue_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssue" ADD CONSTRAINT "LegacyIssue_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssueParcel" ADD CONSTRAINT "LegacyIssueParcel_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "LegacyIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssueComment" ADD CONSTRAINT "LegacyIssueComment_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "LegacyIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssueComment" ADD CONSTRAINT "LegacyIssueComment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssueAttachment" ADD CONSTRAINT "LegacyIssueAttachment_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "LegacyIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyIssueAttachment" ADD CONSTRAINT "LegacyIssueAttachment_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyToService" ADD CONSTRAINT "_AgencyToService_A_fkey" FOREIGN KEY ("A") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyToService" ADD CONSTRAINT "_AgencyToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToReceiver" ADD CONSTRAINT "_CustomerToReceiver_A_fkey" FOREIGN KEY ("A") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToReceiver" ADD CONSTRAINT "_CustomerToReceiver_B_fkey" FOREIGN KEY ("B") REFERENCES "Receiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToService" ADD CONSTRAINT "_ProductToService_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToService" ADD CONSTRAINT "_ProductToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ForwarderToProvider" ADD CONSTRAINT "_ForwarderToProvider_A_fkey" FOREIGN KEY ("A") REFERENCES "Forwarder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ForwarderToProvider" ADD CONSTRAINT "_ForwarderToProvider_B_fkey" FOREIGN KEY ("B") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
