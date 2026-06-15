# Seed the LOCAL ablefy backend with the demo's creator + coaching product.
#
#   Lena Brandt / "The Systems Studio"  (slug: the-systems-studio, can_sell)
#   └─ "Lena AI — Systems Coach"        (MEMBERSHIP product, active, sellable via shop)
#      └─ one-time €9 pricing plan       (the flat-mode price)
#
# The coach is a *membership* product on purpose: flat mode grants unlimited access by
# writing a real MembershipSession (ablefy's access primitive), and only membership-form
# products create one (Sellable#process_membership_session! is gated on is_membership?).
# Discover surfaces it via GET /v1/shop/{slug}/products?form=membership. (See seed/grant_flat.rb.)
#   + an API key (bearer token) for the MCP to call the shop API
#
# Run against the running local container (NEVER production):
#   docker exec -i elopage-rails-app-1 bin/rails runner - < seed/lena_seed.rb
#
# This file lives in the mcp-demo repo on purpose — demo seeds never land in the
# ablefy backend (see AGENTS.md). Safe to re-run: seller/product are reused by
# slug/name; a fresh API key is minted each run (the last line printed is the token).

abort("refusing to seed in #{Rails.env}") if Rails.env.production?

require "active_support/testing/file_fixtures"
include ActiveSupport::Testing::FileFixtures
include ActionDispatch::TestProcess::FixtureFile
include FactoryBot::Syntax::Methods
begin
  FactoryBot.find_definitions # no-op if factory_bot_rails already loaded them
rescue StandardError
end

SLUG = "the-systems-studio"
PRODUCT_NAME = "Lena AI — Systems Coach"
DESCRIPTION =
  "An AI coach trained on Lena Brandt's second-brain method — capture, weekly " \
  "review, and a Notion/Obsidian system that actually sticks. Ask anything about " \
  "building a personal knowledge system."
PRICE = 9

legal_form = LegalForm.first || create(:legal_form)
sector = Sector.first || create(:sector)
currency = Currency.by_key(Currency::EUR).first || create(:currency)

seller = Seller.where("lower(username) = ?", SLUG).first
if seller.nil?
  seller = create(
    :seller, :with_reseller, :with_active_payment_setting, :push_notific_enabled,
    username: SLUG,
    legal_form: legal_form, sector: sector,
    support_first_name: "Lena", support_last_name: "Brandt"
  )
  puts "[seed] created seller ##{seller.id} (#{seller.username})"
else
  puts "[seed] reusing seller ##{seller.id} (#{seller.username})"
end
# can_sell can be guarded by callbacks; force it so the shop scope includes the product.
seller.update_column(:can_sell, true) unless seller.can_sell?

MEMBERSHIP = Product.forms[:membership]
product = seller.products.where(name: PRODUCT_NAME).first
if product.nil?
  pricing_plan = create(
    :pricing_plan, seller: seller, currency: currency,
    prefs: { price: PRICE, use_preauthorization: true }
  )
  product = create(
    :product,
    seller: seller,
    name: PRODUCT_NAME,
    description: DESCRIPTION,
    form: MEMBERSHIP,
    active: true,
    can_be_sold_via_shop: true,
    display_price: PRICE,
    pricing_plans: [pricing_plan]
  )
  puts "[seed] created product ##{product.id} form=#{product.form} review_passed=#{product.review_passed?}"
else
  # Ensure the coach is a sellable, public membership (flat access → MembershipSession
  # needs is_membership?; discover gates on `private`, see below). Bump updated_at so the
  # shop endpoint's 1-hour, max(updated_at)-keyed cache invalidates (update_columns alone won't).
  product.update_columns(form: MEMBERSHIP, active: true, can_be_sold_via_shop: true,
                         private: false, display_price: PRICE, updated_at: Time.current)
  puts "[seed] reusing product ##{product.id} form=#{product.form} (ensured membership/public)"
end

# Keep discover clean: one coach. The public shop list (GET /v1/shop/{slug}/products) filters
# only by form + `is_private(false)` (for_shop is a no-op without ?for_shop=true), so retire any
# other coach-named products by marking them PRIVATE — and bump updated_at to bust the shop cache.
seller.products.where.not(id: product.id).where("name ILIKE ?", "%Systems Coach%").find_each do |p|
  p.update_columns(private: true, can_be_sold_via_shop: false, active: false, updated_at: Time.current)
  puts "[seed] retired stray coach product ##{p.id} (form=#{p.form}) → private"
end

api_key = ApiKey.create!(form: :api, user: seller.user)
token = api_key.try(:token) || api_key.try(:access_token)

puts "[seed] ---- copy into the MCP env ----"
puts "COACH_PRODUCT_SLUG=#{seller.username}"
puts "ABLEFY_PRODUCT_ID=#{product.id}"
puts "ABLEFY_SELLER_TOKEN=#{token}"
puts "[seed] access_token=#{api_key.try(:access_token)} can_sell=#{seller.reload.can_sell?}"
