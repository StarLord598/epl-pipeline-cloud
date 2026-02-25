# ─── CloudFront Distribution — API Gateway CDN Layer ──────────────────────────
# Provides caching, HTTPS, and custom domain readiness in front of the API.

resource "aws_cloudfront_distribution" "api" {
  comment             = "EPL Pipeline API CDN — ${var.environment}"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100" # US/EU only — budget friendly
  wait_for_deployment = false

  origin {
    domain_name = "${aws_api_gateway_rest_api.epl.id}.execute-api.${var.aws_region}.amazonaws.com"
    origin_id   = "api-gateway"
    origin_path = "/${aws_api_gateway_stage.v1.stage_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api-gateway"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 300  # 5 minutes
    max_ttl     = 3600 # 1 hour
  }

  # /health endpoint — short cache
  ordered_cache_behavior {
    path_pattern           = "/health"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api-gateway"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 60
    max_ttl     = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # To use custom domain, add:
    # acm_certificate_arn      = aws_acm_certificate.api.arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${var.project_name}-api-cdn-${var.environment}"
  }
}
