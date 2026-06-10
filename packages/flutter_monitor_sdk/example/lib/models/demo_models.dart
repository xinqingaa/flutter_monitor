class GithubProfile {
  const GithubProfile({
    required this.login,
    required this.name,
    required this.avatarUrl,
    required this.publicRepos,
    required this.followers,
    required this.htmlUrl,
  });

  final String login;
  final String name;
  final String avatarUrl;
  final int publicRepos;
  final int followers;
  final String htmlUrl;

  factory GithubProfile.fromJson(Map<String, dynamic> json) {
    return GithubProfile(
      login: json['login'] as String? ?? 'flutter',
      name: json['name'] as String? ?? 'Flutter',
      avatarUrl: json['avatar_url'] as String? ?? '',
      publicRepos: json['public_repos'] as int? ?? 0,
      followers: json['followers'] as int? ?? 0,
      htmlUrl: json['html_url'] as String? ?? '',
    );
  }
}

class GithubRepo {
  const GithubRepo({
    required this.id,
    required this.name,
    required this.fullName,
    required this.description,
    required this.stars,
    required this.language,
    required this.updatedAt,
    required this.htmlUrl,
  });

  final int id;
  final String name;
  final String fullName;
  final String description;
  final int stars;
  final String language;
  final DateTime? updatedAt;
  final String htmlUrl;

  factory GithubRepo.fromJson(Map<String, dynamic> json) {
    return GithubRepo(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? 'unknown',
      fullName: json['full_name'] as String? ?? 'flutter/unknown',
      description: json['description'] as String? ?? 'No description',
      stars: json['stargazers_count'] as int? ?? 0,
      language: json['language'] as String? ?? 'Dart',
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? ''),
      htmlUrl: json['html_url'] as String? ?? '',
    );
  }
}

class DemoPost {
  const DemoPost({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
  });

  final int id;
  final int userId;
  final String title;
  final String body;

  factory DemoPost.fromJson(Map<String, dynamic> json) {
    return DemoPost(
      id: json['id'] as int? ?? 0,
      userId: json['userId'] as int? ?? 0,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
    );
  }
}

class DemoComment {
  const DemoComment({
    required this.id,
    required this.name,
    required this.email,
    required this.body,
  });

  final int id;
  final String name;
  final String email;
  final String body;

  factory DemoComment.fromJson(Map<String, dynamic> json) {
    return DemoComment(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      body: json['body'] as String? ?? '',
    );
  }
}

class DemoFeedItem {
  const DemoFeedItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.source,
    required this.metricLabel,
    required this.metricValue,
  });

  final String id;
  final String title;
  final String subtitle;
  final String description;
  final String source;
  final String metricLabel;
  final String metricValue;

  factory DemoFeedItem.fromRepo(GithubRepo repo) {
    return DemoFeedItem(
      id: 'repo_${repo.id}',
      title: repo.name,
      subtitle: repo.fullName,
      description: repo.description,
      source: 'GitHub',
      metricLabel: 'Stars',
      metricValue: repo.stars.toString(),
    );
  }

  factory DemoFeedItem.fromPost(DemoPost post) {
    return DemoFeedItem(
      id: 'post_${post.id}',
      title: post.title,
      subtitle: 'JSONPlaceholder user ${post.userId}',
      description: post.body,
      source: 'JSONPlaceholder',
      metricLabel: 'Post',
      metricValue: '#${post.id}',
    );
  }
}

class HomeFeedState {
  const HomeFeedState({
    required this.profile,
    required this.repos,
    required this.posts,
  });

  final GithubProfile profile;
  final List<GithubRepo> repos;
  final List<DemoPost> posts;

  List<DemoFeedItem> get items {
    return <DemoFeedItem>[
      for (final repo in repos.take(5)) DemoFeedItem.fromRepo(repo),
      for (final post in posts.take(4)) DemoFeedItem.fromPost(post),
    ];
  }
}
